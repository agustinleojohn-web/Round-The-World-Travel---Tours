// ========== CONFIGURATION ==========
// IMPORTANT: Replace this URL with your actual Google Apps Script deployment URL
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyky7Er1lNJzuI1UrXsrKseaYsrcR46RU7qHBCPiVE6EJomp6XVC-CIrjZxSPEqv4lh_w/exec';

// Cache configuration (in milliseconds)
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ========== GOOGLE DRIVE URL CONVERTER ==========
/**
 * Converts Google Drive sharing link to direct thumbnail URL
 * @param {string} url - Google Drive link (e.g., https://drive.google.com/file/d/ID/view?usp=drive_link)
 * @param {string} size - Thumbnail size (default: w800)
 * @returns {string} - Direct thumbnail URL
 */
// Improve convertGoogleDriveUrl() for better ID extraction:
// --- Gallery JS (scripts/main.js) ---

// Ensure this function is defined at the top of your JS or before use
function convertGoogleDriveUrl(url, size = 'w800') {
    if (!url || typeof url !== 'string' || url.trim() === '') {
        return ''; // Return empty string for invalid/empty URL
    }
    url = url.trim();

    // If it's already a direct image URL (e.g., from Imgur, your domain)
    if (!url.includes('drive.google.com')) {
        return url;
    }

    // Check if it's already a thumbnail URL
    if (url.includes('drive.google.com/thumbnail')) {
        return url;
    }
    
    let fileId = null;

    // Pattern 1: https://drive.google.com/file/d/FILE_ID/view
    const viewMatch = url.match(/\/file\/d\/([^\/]+)\/view/);
    if (viewMatch && viewMatch[1]) {
        fileId = viewMatch[1];
    } 
    // Pattern 2: https://drive.google.com/open?id=FILE_ID
    else {
        const openMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (openMatch && openMatch[1]) {
            fileId = openMatch[1];
        }
    }
    
    if (fileId) {
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=${size}`;
    }
    
    // If no ID could be extracted, return original URL (might be a direct link already)
    // or a placeholder if you prefer
    return url; 
}


// In loadGalleryFromGoogleSheets() function (in scripts/main.js):
// The Apps Script now returns images as an array, so modify the frontend mapping



// In openGalleryModal() function (in scripts/main.js):
// Add onerror for images to show a placeholder if a specific image fails
function openGalleryModal(galleryId) {
    // ... (existing code to find item, set currentGalleryData, currentImages, currentImageIndex)

    const modal = document.getElementById('gallery-modal');
    // ... (existing modal display code)

    // Ensure the main image has an error handler
    const mainImageEl = document.getElementById('gallery-modal-image');
    mainImageEl.onerror = function() {
        console.warn('Main gallery image failed to load, replacing with placeholder:', this.src);
        this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"%3E%3Crect width="300" height="200" fill="%23e0e0e0"/%3E%3Ctext x="150" y="100" font-family="Arial" font-size="16" fill="%23757575" text-anchor="middle" dominant-baseline="middle"%3EImage Unavailable%3C/text%3E%3C/svg%3E';
    };

    // Also add error handlers for thumbnails
    const thumbnailsContainer = document.getElementById('gallery-thumbnails');
    if (thumbnailsContainer) {
        thumbnailsContainer.querySelectorAll('img').forEach(thumbImg => {
            thumbImg.onerror = function() {
                console.warn('Thumbnail image failed to load, replacing with placeholder:', this.src);
                this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="70" height="70" viewBox="0 0 70 70"%3E%3Crect width="70" height="70" fill="%23e0e0e0"/%3E%3Ctext x="35" y="35" font-family="Arial" font-size="10" fill="%23757575" text-anchor="middle" dominant-baseline="middle"%3ENO IMG%3C/text%3E%3C/svg%3E';
            };
        });
    }
    // ... (rest of openGalleryModal)
}

const CACHE_KEYS = {
    packages: 'rtwt_packages_cache',
    testimonials: 'rtwt_testimonials_cache',
    gallery: 'rtwt_gallery_cache',
    packagesMeta: 'rtwt_packages_meta',
    testimonialsMeta: 'rtwt_testimonials_meta',
    galleryMeta: 'rtwt_gallery_meta'
};

// ========== STATE VARIABLES ==========
let allPackages = [];
let allGalleryImages = [];
let allTestimonials = [];
let filteredPackages = [];
let filteredGallery = [];
let cart = [];
const selectedPackages = new Set();
let currentTestimonialIndex = 0;
let testimonialInterval;
let currentGalleryPage = 1;
const galleryPerPage = 9;

// Filter states
let searchQuery = '';
let filterDestination = 'all';
let filterTourType = 'all';
let filterAvailability = 'all';
let sortBy = 'featured';
let viewMode = 'grid';

// Gallery filter states
let galleryFilterYear = 'all';
let galleryFilterDestination = 'all';
let galleryFilterTourType = 'all';

// ========== CACHE MANAGEMENT ==========
function getCachedData(key, metaKey) {
    try {
        const meta = localStorage.getItem(metaKey);
        if (!meta) return null;
        
        const { timestamp } = JSON.parse(meta);
        const now = Date.now();
        
        // Check if cache is still valid
        if (now - timestamp > CACHE_TTL) {
            // Cache expired
            localStorage.removeItem(key);
            localStorage.removeItem(metaKey);
            return null;
        }
        
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('Error reading cache:', error);
        return null;
    }
}

function setCachedData(key, metaKey, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        localStorage.setItem(metaKey, JSON.stringify({
            timestamp: Date.now()
        }));
    } catch (error) {
        console.error('Error saving cache:', error);
        // If localStorage is full, clear old caches
        try {
            Object.values(CACHE_KEYS).forEach(k => {
                if (k !== key && k !== metaKey) {
                    localStorage.removeItem(k);
                }
            });
            // Try again
            localStorage.setItem(key, JSON.stringify(data));
            localStorage.setItem(metaKey, JSON.stringify({
                timestamp: Date.now()
            }));
        } catch (e) {
            console.error('Failed to save cache even after cleanup:', e);
        }
    }
}

// ========== INITIALIZATION ==========
async function init() {
    console.log('🚀 Initializing application...');
    
    // Try to load from cache first for instant display
    const cachedPackages = getCachedData(CACHE_KEYS.packages, CACHE_KEYS.packagesMeta);
    const cachedTestimonials = getCachedData(CACHE_KEYS.testimonials, CACHE_KEYS.testimonialsMeta);
    const cachedGallery = getCachedData(CACHE_KEYS.gallery, CACHE_KEYS.galleryMeta);
    
    // Show cached data immediately if available
    if (cachedPackages) {
        console.log('✅ Loading packages from cache');
        allPackages = cachedPackages;
        populatePackageFilters();
        applyFilters();
        document.getElementById('packages-loading')?.classList.add('hidden');
        document.getElementById('packages-controls')?.classList.remove('hidden');
    }
    
    if (cachedTestimonials && cachedTestimonials.length > 0) {
        console.log('✅ Loading testimonials from cache');
        allTestimonials = cachedTestimonials;
        renderTestimonial();
        startTestimonialAutoplay();
    }
    
    if (cachedGallery && cachedGallery.length > 0) {
        console.log('✅ Loading gallery from cache');
        allGalleryImages = cachedGallery;
        populateGalleryFilters();
        renderGallery();
    }
    
    // Setup event listeners and UI
    setupEventListeners();
    setupBackToTop();
    setupHeaderScroll();
    setupCounterAnimation();
    
    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    
    // Load fresh data in background
    console.log('🔄 Fetching fresh data in background...');
    loadFreshData();
}

async function loadFreshData() {
    // Load data in parallel for better performance
    const loadingPromises = [
        loadPackagesFromGoogleSheets(),
        loadTestimonialsFromGoogleSheets(),
        loadGalleryFromGoogleSheets()
    ];
    
    try {
        await Promise.all(loadingPromises);
        console.log('✅ Fresh data loaded successfully');
    } catch (error) {
        console.error('Error loading fresh data:', error);
    }
}

// ========== EVENT LISTENERS ==========
function setupEventListeners() {
    // Mobile menu
    document.getElementById('mobile-menu-btn')?.addEventListener('click', toggleMobileMenu);
   
document.getElementById('mobile-menu-close-btn')?.addEventListener('click', closeMobileMenu);
    // Mobile menu links
    document.querySelectorAll('.mobile-menu-link').forEach(link => {
        link.addEventListener('click', closeMobileMenu);
    });
    
    // Form submissions
    document.getElementById('booking-form')?.addEventListener('submit', handleBookingSubmit);
    document.getElementById('contact-form')?.addEventListener('submit', handleContactSubmit);
    
    // Search and filters
    document.getElementById('search-input')?.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        applyFilters();
    });
    
    document.getElementById('filter-destination')?.addEventListener('change', (e) => {
        filterDestination = e.target.value;
        applyFilters();
    });
    
    document.getElementById('filter-tour-type')?.addEventListener('change', (e) => {
        filterTourType = e.target.value;
        applyFilters();
    });
    
    document.getElementById('filter-availability')?.addEventListener('change', (e) => {
        filterAvailability = e.target.value;
        applyFilters();
    });
    
    document.getElementById('sort-by')?.addEventListener('change', (e) => {
        sortBy = e.target.value;
        applyFilters();
    });
    
    // Gallery filters
    document.getElementById('gallery-filter-year')?.addEventListener('change', (e) => {
        galleryFilterYear = e.target.value;
        currentGalleryPage = 1;
        renderGallery();
    });
    
    document.getElementById('gallery-filter-destination')?.addEventListener('change', (e) => {
        galleryFilterDestination = e.target.value;
        currentGalleryPage = 1;
        renderGallery();
    });
    
    document.getElementById('gallery-filter-tourtype')?.addEventListener('change', (e) => {
        galleryFilterTourType = e.target.value;
        currentGalleryPage = 1;
        renderGallery();
    });
    
    // Close modal on background click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('open');
                document.body.style.overflow = '';
            }
        });
    });
}

// ========== MOBILE MENU ==========
// --- Mobile Menu JS (scripts/main.js) ---

function toggleMobileMenu() {
    const mobileMenu = document.getElementById('mobile-menu');
    const overlay = document.getElementById('mobile-menu-overlay');
    const body = document.body;
    
    if (mobileMenu.classList.contains('hidden')) {
        // OPEN MENU
        mobileMenu.classList.remove('hidden'); // Remove 'hidden' to trigger slide-in
        overlay.classList.add('active');      // Show overlay
        body.classList.add('menu-open');      // Lock body scroll
        
        // Add event listener for overlay click/tap to close menu
        overlay.addEventListener('click', closeMobileMenu, { once: true }); // Use once: true to prevent multiple listeners
    } else {
        // CLOSE MENU
        closeMobileMenu(); // Call the unified close function
    }
}

function closeMobileMenu() {
    const mobileMenu = document.getElementById('mobile-menu');
    const overlay = document.getElementById('mobile-menu-overlay');
    const body = document.body;
    
    // Ensure both classes are removed
    mobileMenu.classList.add('hidden');       // Add 'hidden' to trigger slide-out
    overlay.classList.remove('active');       // Hide overlay
    body.classList.remove('menu-open');       // Unlock body scroll

    // Remove the event listener if it was added
    overlay.removeEventListener('click', closeMobileMenu);
}

// Attach event listener to mobile menu links to close the menu on navigation
document.querySelectorAll('.mobile-menu-link').forEach(link => {
    link.addEventListener('click', (event) => {
        // Only close if it's not preventing default (e.g., hash links)
        if (!event.defaultPrevented) {
            closeMobileMenu();
        }
    });
});

// ========== HEADER SCROLL EFFECT ==========
function setupHeaderScroll() {
    const header = document.getElementById('main-header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });
}

// ========== COUNTER ANIMATION ==========
function setupCounterAnimation() {
    const counters = document.querySelectorAll('.counter');
    let animated = false;
    
    const animateCounters = () => {
        if (animated) return;
        
        counters.forEach(counter => {
            const target = parseInt(counter.getAttribute('data-target'));
            const duration = 2000;
            const increment = target / (duration / 16);
            let current = 0;
            
            const updateCounter = () => {
                current += increment;
                if (current < target) {
                    counter.textContent = Math.floor(current);
                    requestAnimationFrame(updateCounter);
                } else {
                    counter.textContent = target;
                }
            };
            
            updateCounter();
        });
        
        animated = true;
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounters();
            }
        });
    }, { threshold: 0.5 });
    
    counters.forEach(counter => observer.observe(counter));
}

// ========== GOOGLE SHEETS DATA LOADING WITH CACHE ==========
async function loadPackagesFromGoogleSheets() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?action=getPackages`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        const data = await response.json();
        
        if (data.success && data.packages && data.packages.length > 0) {
            allPackages = data.packages.map(pkg => ({
                ...pkg,
                image: convertGoogleDriveUrl(pkg.image),
                featured: pkg.rating >= 4.5 || pkg.featured === true
            }));
            
            // Save to cache
            setCachedData(CACHE_KEYS.packages, CACHE_KEYS.packagesMeta, allPackages);
            console.log('✅ Packages loaded and cached');
        } else {
            // Only use fallback if we don't have cached data
            if (allPackages.length === 0) {
                allPackages = getFallbackPackages();
            }
        }
    } catch (error) {
        console.error('Error loading packages:', error);
        // Only use fallback if we don't have cached data
        if (allPackages.length === 0) {
            allPackages = getFallbackPackages();
        }
    }
    
    // Hide loading, show controls
    const loadingEl = document.getElementById('packages-loading');
    const controlsEl = document.getElementById('packages-controls');
    if (loadingEl) loadingEl.classList.add('hidden');
    if (controlsEl) controlsEl.classList.remove('hidden');
    
    populatePackageFilters();
    applyFilters();
    
    // Update stats counter with real data
    updateStatsCounter();
}

async function loadTestimonialsFromGoogleSheets() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?action=getTestimonials`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        const data = await response.json();
        
        if (data.success && data.testimonials && data.testimonials.length > 0) {
            allTestimonials = data.testimonials;
            
            // Save to cache
            setCachedData(CACHE_KEYS.testimonials, CACHE_KEYS.testimonialsMeta, allTestimonials);
            console.log('✅ Testimonials loaded and cached');
            
            // Update display
            renderTestimonial();
        } else {
            // Only use fallback if we don't have cached data
            if (allTestimonials.length === 0) {
                allTestimonials = getFallbackTestimonials();
                renderTestimonial();
            }
        }
    } catch (error) {
        console.error('Error loading testimonials:', error);
        // Only use fallback if we don't have cached data
        if (allTestimonials.length === 0) {
            allTestimonials = getFallbackTestimonials();
            renderTestimonial();
        }
    }
}

async function loadGalleryFromGoogleSheets() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?action=getGallery`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        const data = await response.json();
        
        if (data.success && data.gallery && data.gallery.length > 0) {
            // Map the data from Google Sheets format
            // Support multiple images separated by commas
            allGalleryImages = data.gallery.map(item => {
                // Split images by comma if multiple images are provided
                const images = (item.imageurl || item.image || '').replace(/\|/g, ',').split(',').map(url => url.trim()).filter(url => url); // Replace | with ,
                
                // Convert all Google Drive URLs to thumbnail format
                const convertedImages = images.map(url => convertGoogleDriveUrl(url));
                
                return {
                    id: item.id,
                    title: item.title,
                    destination: item.destination,
                    tourType: item.tourtype || item.tourType,
                    year: item.year,
                    images: convertedImages, // Array of converted image URLs
                    thumbnail: convertedImages[0] || '', // First image as thumbnail
                    description: item.description,
                    clientName: item.clientname || item.clientName || item.title
                };
            });
            
            // Save to cache
            setCachedData(CACHE_KEYS.gallery, CACHE_KEYS.galleryMeta, allGalleryImages);
            console.log('✅ Gallery loaded and cached');
            
            // Update display
            populateGalleryFilters();
            renderGallery();
        } else {
            // Only use fallback if we don't have cached data
            if (allGalleryImages.length === 0) {
                allGalleryImages = getFallbackGallery();
                populateGalleryFilters();
                renderGallery();
            }
        }
    } catch (error) {
        console.error('Error loading gallery:', error);
        // Only use fallback if we don't have cached data
        if (allGalleryImages.length === 0) {
            allGalleryImages = getFallbackGallery();
            populateGalleryFilters();
            renderGallery();
        }
    }
}

// ========== DYNAMIC FILTER POPULATION ==========
function populatePackageFilters() {
    // Get unique destinations
    const destinations = [...new Set(allPackages.map(pkg => pkg.destination))].sort();
    const destinationSelect = document.getElementById('filter-destination');
    if (destinationSelect) {
        // Keep "All Destinations" option
        const currentValue = destinationSelect.value;
        destinationSelect.innerHTML = '<option value="all">All Destinations</option>';
        destinations.forEach(dest => {
            const option = document.createElement('option');
            option.value = dest;
            option.textContent = dest;
            destinationSelect.appendChild(option);
        });
        // Restore selection if still valid
        if (destinations.includes(currentValue)) {
            destinationSelect.value = currentValue;
        }
    }
    
    // Get unique tour types
    const tourTypes = [...new Set(allPackages.map(pkg => pkg.tourType))].sort();
    const tourTypeSelect = document.getElementById('filter-tour-type');
    if (tourTypeSelect) {
        const currentValue = tourTypeSelect.value;
        tourTypeSelect.innerHTML = '<option value="all">All Types</option>';
        tourTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            tourTypeSelect.appendChild(option);
        });
        if (tourTypes.includes(currentValue)) {
            tourTypeSelect.value = currentValue;
        }
    }
}

function populateGalleryFilters() {
    // Get unique years
    const years = [...new Set(allGalleryImages.map(img => img.year))].sort().reverse();
    const yearSelect = document.getElementById('gallery-filter-year');
    if (yearSelect) {
        const currentValue = yearSelect.value;
        yearSelect.innerHTML = '<option value="all">All Years</option>';
        years.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearSelect.appendChild(option);
        });
        if (years.includes(currentValue)) {
            yearSelect.value = currentValue;
        }
    }
    
    // Get unique destinations
    const destinations = [...new Set(allGalleryImages.map(img => img.destination))].sort();
    const destSelect = document.getElementById('gallery-filter-destination');
    if (destSelect) {
        const currentValue = destSelect.value;
        destSelect.innerHTML = '<option value="all">All Destinations</option>';
        destinations.forEach(dest => {
            const option = document.createElement('option');
            option.value = dest;
            option.textContent = dest;
            destSelect.appendChild(option);
        });
        if (destinations.includes(currentValue)) {
            destSelect.value = currentValue;
        }
    }
    
    // Get unique tour types
    const tourTypes = [...new Set(allGalleryImages.map(img => img.tourType))].sort();
    const typeSelect = document.getElementById('gallery-filter-tourtype');
    if (typeSelect) {
        const currentValue = typeSelect.value;
        typeSelect.innerHTML = '<option value="all">All Tour Types</option>';
        tourTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            typeSelect.appendChild(option);
        });
        if (tourTypes.includes(currentValue)) {
            typeSelect.value = currentValue;
        }
    }
}

// ========== FALLBACK DATA ==========
function getFallbackPackages() {
    return [
        {
            id: 'pkg1',
            name: 'Boracay Beach Paradise',
            destination: 'Boracay',
            duration: '3 Days / 2 Nights',
            price: 8500,
            image: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800',
            tourType: 'Beach',
            rating: 4.8,
            availability: 'Available'
        },
        {
            id: 'pkg2',
            name: 'Palawan El Nido Adventure',
            destination: 'Palawan',
            duration: '4 Days / 3 Nights',
            price: 12500,
            image: 'https://images.unsplash.com/photo-1583260088009-891b69d48aff?w=800',
            tourType: 'Adventure',
            rating: 4.9,
            availability: 'Available'
        },
        {
            id: 'pkg3',
            name: 'Japan Cherry Blossom Tour',
            destination: 'Tokyo, Japan',
            duration: '7 Days / 6 Nights',
            price: 65000,
            image: 'https://images.unsplash.com/photo-1522383225653-ed111181a951?w=800',
            tourType: 'Cultural',
            rating: 5.0,
            availability: 'Limited'
        }
    ];
}

function getFallbackTestimonials() {
    return [
        {
            name: 'Maria Santos',
            location: 'Manila, Philippines',
            rating: 5,
            text: 'Our Boracay trip was absolutely amazing! Round-The-World Travel & Tours took care of everything from flights to hotel. The team was very professional and responsive. Highly recommended!',
            date: 'October 2024',
            package: 'Boracay Beach Paradise'
        },
        {
            name: 'John Reyes',
            location: 'Quezon City, Philippines',
            rating: 5,
            text: 'Best travel agency ever! They customized our Palawan package to fit our budget and preferences. The experience was unforgettable. Will definitely book with them again!',
            date: 'September 2024',
            package: 'Palawan El Nido Adventure'
        },
        {
            name: 'Sarah Lee',
            location: 'Makati, Philippines',
            rating: 5,
            text: 'Our Japan trip was a dream come true! Everything was perfectly organized. The guides were knowledgeable and friendly. Thank you Round-The-World Travel & Tours!',
            date: 'August 2024',
            package: 'Japan Cherry Blossom Tour'
        }
    ];
}

function getFallbackGallery() {
    return [
        {
            id: 'gal1',
            title: 'The Santos Family - Boracay Paradise',
            destination: 'Boracay',
            tourType: 'Beach',
            year: '2024',
            images: [
                'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800',
                'https://images.unsplash.com/photo-1573843981267-be1999ff37cd?w=800',
                'https://images.unsplash.com/photo-1542259009477-d625272157b7?w=800'
            ],
            thumbnail: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800',
            description: 'White Beach sunset and crystal clear waters',
            clientName: 'Santos Family'
        },
        {
            id: 'gal2',
            title: 'The Reyes Group - Palawan Island Hopping',
            destination: 'Palawan',
            tourType: 'Adventure',
            year: '2024',
            images: [
                'https://images.unsplash.com/photo-1583260088009-891b69d48aff?w=800',
                'https://images.unsplash.com/photo-1584302179602-e4c3d3fd629d?w=800'
            ],
            thumbnail: 'https://images.unsplash.com/photo-1583260088009-891b69d48aff?w=800',
            description: 'El Nido lagoons and hidden beaches',
            clientName: 'Reyes Group'
        },
        {
            id: 'gal3',
            title: 'The Lee Family - Tokyo Adventure',
            destination: 'Japan',
            tourType: 'Cultural',
            year: '2024',
            images: [
                'https://images.unsplash.com/photo-1522383225653-ed111181a951?w=800',
                'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800',
                'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800'
            ],
            thumbnail: 'https://images.unsplash.com/photo-1522383225653-ed111181a951?w=800',
            description: 'Cherry blossoms and ancient temples',
            clientName: 'Lee Family'
        },
        {
            id: 'gal4',
            title: 'The Cruz Family - Bohol Tour',
            destination: 'Bohol',
            tourType: 'Adventure',
            year: '2023',
            images: [
                'https://images.unsplash.com/photo-1580296048461-a561cf1e4e0d?w=800',
                'https://images.unsplash.com/photo-1566054757965-c2b2c1e2d88a?w=800'
            ],
            thumbnail: 'https://images.unsplash.com/photo-1580296048461-a561cf1e4e0d?w=800',
            description: 'The famous Chocolate Hills and amazing wildlife',
            clientName: 'Cruz Family'
        },
        {
            id: 'gal5',
            title: 'The Garcia Team - Singapore Getaway',
            destination: 'Singapore',
            tourType: 'Cultural',
            year: '2024',
            images: [
                'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=800',
                'https://images.unsplash.com/photo-1506012787146-f92b2d7d6d96?w=800',
                'https://images.unsplash.com/photo-1508964942454-1a56651d54ac?w=800'
            ],
            thumbnail: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=800',
            description: 'Marina Bay Sands and Gardens by the Bay',
            clientName: 'Garcia Team'
        },
        {
            id: 'gal6',
            title: 'The Mendoza Friends - Coron Island',
            destination: 'Palawan',
            tourType: 'Beach',
            year: '2023',
            images: [
                'https://images.unsplash.com/photo-1621277224630-81a35eb42a86?w=800'
            ],
            thumbnail: 'https://images.unsplash.com/photo-1621277224630-81a35eb42a86?w=800',
            description: 'Island hopping paradise in Coron',
            clientName: 'Mendoza Friends'
        }
    ];
}



// ========== PACKAGE FILTERING ==========
function applyFilters() {
    filteredPackages = allPackages.filter(pkg => {
        const matchesSearch = pkg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            pkg.destination.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesDestination = filterDestination === 'all' || pkg.destination === filterDestination;
        const matchesTourType = filterTourType === 'all' || pkg.tourType === filterTourType;
        const matchesAvailability = filterAvailability === 'all' || pkg.availability === filterAvailability;
        
        return matchesSearch && matchesDestination && matchesTourType && matchesAvailability;
    });
    
    // Sorting
    if (sortBy === 'price-low') {
        filteredPackages.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-high') {
        filteredPackages.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'rating') {
        filteredPackages.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === 'featured') {
        filteredPackages.sort((a, b) => {
            if (a.featured && !b.featured) return -1;
            if (!a.featured && b.featured) return 1;
            return b.rating - a.rating;
        });
    }
    
    render();
}

// ========== RENDER PACKAGES ==========
function render() {
    updateResultsCount();
    if (viewMode === 'grid') {
        renderGrid();
    } else {
        renderList();
    }
}

function updateResultsCount() {
    const resultsCount = document.getElementById('results-count');
    if (resultsCount) {
        resultsCount.textContent = `Showing ${filteredPackages.length} package${filteredPackages.length !== 1 ? 's' : ''}`;
    }
}

function toggleViewMode(mode) {
    viewMode = mode;
    document.getElementById('grid-view-btn').classList.toggle('active', mode === 'grid');
    document.getElementById('list-view-btn').classList.toggle('active', mode === 'list');
    document.getElementById('packages-grid').classList.toggle('hidden', mode === 'list');
    document.getElementById('packages-list').classList.toggle('hidden', mode === 'grid');
    render();
}

function renderGrid() {
    const grid = document.getElementById('packages-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    if (filteredPackages.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center py-12 text-gray-500">No packages found matching your criteria</div>';
        return;
    }
    
    filteredPackages.forEach(pkg => {
        // Safely handle optional fields
        const inclusions = pkg.inclusions || '';
        const highlights = pkg.highlights || '';
        const travelDates = pkg.travelDates || '';
        
        const inclusionsList = inclusions ? inclusions.split(',').slice(0, 3).map(i => `<li class="text-sm text-gray-600">✓ ${i.trim()}</li>`).join('') : '';
        const highlightsList = highlights ? highlights.split(',').slice(0, 3).map(h => `<li class="text-sm text-gray-600">• ${h.trim()}</li>`).join('') : '';
        const travelDatesDisplay = travelDates ? travelDates.split('|')[0].trim() : 'Contact for dates';
        const inclusionsCount = inclusions ? inclusions.split(',').length : 0;
        const highlightsCount = highlights ? highlights.split(',').length : 0;
        
        const card = `
            <div class="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition duration-300 relative package-card" data-id="${pkg.id}">
                <div class="relative">
                    <img src="${pkg.image}" alt="${pkg.name}" class="w-full h-48 object-cover" loading="lazy">
                    ${pkg.featured ? '<div class="absolute top-3 right-3 bg-gradient-to-r from-orange-500 to-red-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">⭐ Featured</div>' : ''}
                    ${travelDates ? `<div class="absolute bottom-3 left-3 bg-black/70 text-white px-3 py-1 rounded-lg text-xs font-semibold"><i data-lucide="calendar" class="w-3 h-3 inline"></i> ${travelDatesDisplay}</div>` : ''}
                </div>
                <div class="p-6">
                    <h3 class="text-xl font-semibold mb-2 line-clamp-2">${pkg.name}</h3>
                    <div class="flex items-center gap-2 text-gray-600 mb-2">
                        <i data-lucide="map-pin" class="w-4 h-4"></i>
                        <span>${pkg.destination}</span>
                    </div>
                    <div class="flex items-center gap-2 text-gray-600 mb-3">
                        <i data-lucide="clock" class="w-4 h-4"></i>
                        <span>${pkg.duration}</span>
                    </div>
                    
                    ${inclusionsList ? `
                    <div class="mb-3 border-t pt-3">
                        <div class="font-semibold text-sm text-gray-700 mb-1">Inclusions:</div>
                        <ul class="space-y-1">${inclusionsList}</ul>
                        ${inclusionsCount > 3 ? '<div class="text-xs text-blue-600 mt-1">+' + (inclusionsCount - 3) + ' more...</div>' : ''}
                    </div>
                    ` : ''}
                    
                    ${highlightsList ? `
                    <div class="mb-3 border-t pt-3">
                        <div class="font-semibold text-sm text-gray-700 mb-1">Highlights:</div>
                        <ul class="space-y-1">${highlightsList}</ul>
                        ${highlightsCount > 3 ? '<div class="text-xs text-blue-600 mt-1">+' + (highlightsCount - 3) + ' more...</div>' : ''}
                    </div>
                    ` : ''}
                    
                    <div class="flex items-center justify-between mb-4 border-t pt-3">
                        <div class="flex items-center gap-1">
                            <i data-lucide="star" class="w-4 h-4 fill-yellow-400 text-yellow-400"></i>
                            <span class="font-semibold">${pkg.rating}</span>
                        </div>
                        <span class="badge badge-blue">${pkg.tourType}</span>
                    </div>
                    
                    <div class="border-t pt-4">
                        <div class="flex items-center justify-between mb-3">
                            <div>
                                <div class="text-2xl font-bold text-blue-600">₱${Number(pkg.price).toLocaleString()}</div>
                                <div class="text-sm text-gray-500">per person</div>
                            </div>
                            <span class="badge ${pkg.availability === 'Available' ? 'badge-green' : 'badge-amber'}">${pkg.availability}</span>
                        </div>
                        
                        <div class="flex gap-2">
                            <button onclick="viewPackageDetails('${pkg.id}')" class="btn btn-outline flex-1 text-sm">
                                <i data-lucide="info" class="w-4 h-4"></i>
                                Details
                            </button>
                            <button onclick="addToCartSingle('${pkg.id}')" class="btn btn-primary flex-1 text-sm">
                                <i data-lucide="shopping-cart" class="w-4 h-4"></i>
                                Add to Cart
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        grid.innerHTML += card;
    });
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function renderList() {
    const tbody = document.querySelector('#packages-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (filteredPackages.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center py-12 text-gray-500">No packages found matching your criteria</td></tr>';
        return;
    }
    
    filteredPackages.forEach(pkg => {
        const isChecked = selectedPackages.has(pkg.id);
        const travelDates = (pkg.travelDates || '').split('|')[0].trim() || 'Contact for dates';
        const inclusionsPreview = pkg.inclusions ? pkg.inclusions.split(',').slice(0, 2).join(', ') : '';
        const highlightsPreview = pkg.highlights ? pkg.highlights.split(',').slice(0, 2).join(', ') : '';
        const hotelDetails = pkg.hotelDetails || '';
        
        const row = `
            <tr class="hover:bg-gray-50 cursor-pointer" onclick="viewPackageDetails('${pkg.id}')">
                <td data-label="Select" onclick="event.stopPropagation()">
                    <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="togglePackageSelection('${pkg.id}')">
                </td>
                <td data-label="Package">
                    <div class="flex items-center gap-3">
                        <img src="${pkg.image}" alt="${pkg.name}" class="w-20 h-20 rounded-lg object-cover" loading="lazy" width="80" height="80">
                        <div class="max-w-md">
                            <div class="font-semibold mb-1">${pkg.name}</div>
                            ${pkg.featured ? '<span class="badge badge-orange mb-1">Featured</span>' : ''}
                            ${highlightsPreview ? `<div class="text-xs text-gray-500 mt-1 line-clamp-1">🎯 ${highlightsPreview}...</div>` : ''}
                        </div>
                    </div>
                </td>
                <td data-label="Destination">
                    <div class="flex items-center gap-1">
                        <i data-lucide="map-pin" class="w-4 h-4 text-gray-400"></i>
                        ${pkg.destination}
                    </div>
                </td>
                <td data-label="Duration">
                    <div class="flex items-center gap-1 mb-1">
                        <i data-lucide="clock" class="w-4 h-4 text-gray-400"></i>
                        ${pkg.duration}
                    </div>
                    <div class="text-xs text-gray-500">
                        <i data-lucide="calendar" class="w-3 h-3 inline"></i> ${travelDates}
                    </div>
                </td>
                <td data-label="Type">
                    <span class="badge badge-blue">${pkg.tourType}</span>
                </td>
                <td data-label="Details">
                    <div class="text-sm">
                        ${inclusionsPreview ? `<div class="mb-1 text-gray-600">✓ ${inclusionsPreview}...</div>` : ''}
                        ${hotelDetails ? `<div class="text-xs text-gray-500">🏨 ${hotelDetails}</div>` : ''}
                    </div>
                </td>
                <td data-label="Price" class="font-semibold">
                    <div class="text-lg text-blue-600">₱${Number(pkg.price).toLocaleString()}</div>
                    <div class="text-xs text-gray-500">per person</div>
                </td>
                <td data-label="Rating">
                    <div class="flex items-center gap-1">
                        <i data-lucide="star" class="w-4 h-4 fill-yellow-400 text-yellow-400"></i>
                        <span class="font-semibold">${pkg.rating}</span>
                    </div>
                </td>
                <td data-label="Status">
                    <span class="badge ${pkg.availability === 'Available' ? 'badge-green' : 'badge-amber'}">${pkg.availability}</span>
                </td>
                <td data-label="Action" class="text-right" onclick="event.stopPropagation()">
                    <div class="flex gap-2 justify-end">
                        <button onclick="viewPackageDetails('${pkg.id}')" class="btn btn-outline btn-sm" title="View Details">
                            <i data-lucide="info" class="w-4 h-4"></i>
                        </button>
                        <button onclick="addToCartSingle('${pkg.id}')" class="btn btn-primary btn-sm" title="Add to Cart">
                            <i data-lucide="shopping-cart" class="w-4 h-4"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// ========== PACKAGE SELECTION ==========
function togglePackageSelection(id) {
    if (selectedPackages.has(id)) {
        selectedPackages.delete(id);
    } else {
        selectedPackages.add(id);
    }
    updateSelectedCount();
    render();
}

function toggleSelectAll() {
    const checkbox = document.getElementById('select-all');
    if (checkbox.checked) {
        filteredPackages.forEach(pkg => selectedPackages.add(pkg.id));
    } else {
        selectedPackages.clear();
    }
    updateSelectedCount();
    render();
}

function updateSelectedCount() {
    const count = selectedPackages.size;
    document.getElementById('selected-count').textContent = count;
    const addBtn = document.getElementById('add-selected-btn');
    if (viewMode === 'list' && count > 0) {
        addBtn.classList.remove('hidden');
    } else {
        addBtn.classList.add('hidden');
    }
}

// ========== CART MANAGEMENT ==========
function addSelectedToCart() {
    let addedCount = 0;
    selectedPackages.forEach(id => {
        const pkg = allPackages.find(p => p.id === id);
        if (pkg) {
            const existing = cart.find(item => item.package.id === id);
            if (!existing) {
                cart.push({ package: pkg, quantity: 1 });
                addedCount++;
            }
        }
    });

    if (addedCount > 0) {
        showToast(`${addedCount} package(s) added to cart`, 'success');
        selectedPackages.clear();
        updateSelectedCount();
        renderCart();
        render();
    }
}

function addToCartSingle(id) {
    const pkg = allPackages.find(p => p.id === id);
    if (!pkg) return;

    const existing = cart.find(item => item.package.id === id);
    if (existing) {
        existing.quantity++;
        showToast(`${pkg.name} quantity increased`, 'success');
    } else {
        cart.push({ package: pkg, quantity: 1 });
        showToast(`${pkg.name} added to cart`, 'success');
    }

    renderCart();
}

function removeFromCart(id) {
    const pkg = cart.find(item => item.package.id === id);
    cart = cart.filter(item => item.package.id !== id);
    if (pkg) {
        showToast(`${pkg.package.name} removed from cart`, 'error');
    }
    renderCart();
}

function clearCart() {
    cart = [];
    showToast('Cart cleared', 'info');
    renderCart();
}

function toggleCartPopup() {
    const cartPopup = document.getElementById('cart-popup');
    if (cartPopup.classList.contains('hidden')) {
        cartPopup.classList.remove('hidden');
    } else {
        cartPopup.classList.add('hidden');
    }
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function closeCart() {
    document.getElementById('cart-popup').classList.add('hidden');
}

function renderCart() {
    const floatingCartBtn = document.getElementById('floating-cart-btn');
    const cartPopup = document.getElementById('cart-popup');
    const cartItems = document.getElementById('cart-items');
    const cartCount = document.getElementById('cart-count');
    const floatingCartCount = document.getElementById('floating-cart-count');
    const cartTotal = document.getElementById('cart-total');

    cartCount.textContent = cart.length;
    floatingCartCount.textContent = cart.length;

    if (cart.length === 0) {
        floatingCartBtn.classList.add('hidden');
        cartPopup.classList.add('hidden');
        return;
    }

    floatingCartBtn.classList.remove('hidden');

    let total = 0;
    cartItems.innerHTML = '';

    cart.forEach(item => {
        total += item.package.price * item.quantity;
        const cartItem = `
            <div class="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg">
                <div class="flex-1">
                    <div class="text-sm font-semibold">${item.package.name}</div>
                    <div class="text-xs text-gray-600">₱${Number(item.package.price).toLocaleString()} × ${item.quantity}</div>
                </div>
                <button onclick="removeFromCart('${item.package.id}')" class="text-gray-400 hover:text-red-600">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>
        `;
        cartItems.innerHTML += cartItem;
    });

    cartTotal.textContent = total.toLocaleString();
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// ========== MODALS ==========
function openBookingModal() {
    console.log('openBookingModal called, cart length:', cart.length);
    
    if (cart.length === 0) {
        showToast('Please add packages to cart first', 'error');
        return;
    }

    const modal = document.getElementById('booking-modal');
    const selectedInfo = document.getElementById('selected-packages-info');
    const packagesList = document.getElementById('modal-packages-list'); // FIXED ID
    const packagesCount = document.getElementById('packages-count');
    const modalTotal = document.getElementById('modal-total');
    const singlePackagePreview = document.getElementById('single-package-preview');
    const singlePackageImage = document.getElementById('single-package-image');

    if (!modal) {
        console.error('Booking modal element not found!');
        return;
    }

    console.log('Modal element found:', modal);
    
    if (packagesCount) packagesCount.textContent = cart.length;

    if (cart.length === 1 && singlePackageImage && singlePackagePreview) {
        singlePackageImage.src = cart[0].package.image;
        singlePackageImage.alt = cart[0].package.name;
        singlePackagePreview.classList.remove('hidden');
    } else if (singlePackagePreview) {
        singlePackagePreview.classList.add('hidden');
    }

    let total = 0;
    if (packagesList) {
        packagesList.innerHTML = '';

        cart.forEach(item => {
            total += item.package.price * item.quantity;
            const pkgItem = `
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <div class="font-medium">${item.package.name}</div>
                        <div class="text-xs text-gray-500">${item.package.destination} • ${item.package.duration}</div>
                    </div>
                    <div class="text-right">
                        <div>₱${Number(item.package.price).toLocaleString()} × ${item.quantity}</div>
                        <div class="font-semibold text-blue-600">₱${(item.package.price * item.quantity).toLocaleString()}</div>
                    </div>
                </div>
            `;
            packagesList.innerHTML += pkgItem;
        });
    }

    if (modalTotal) modalTotal.textContent = total.toLocaleString();
    if (selectedInfo) selectedInfo.classList.remove('hidden');
    
    // Add the open class to display the modal
    modal.classList.add('open');
    console.log('Modal opened, classes:', modal.classList.toString());
    
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function closeBookingModal() {
    const modal = document.getElementById('booking-modal');
    if (modal) {
        modal.classList.remove('open');
        // Re-enable body scroll
        document.body.style.overflow = '';
    }
}

// ========== FORM SUBMISSIONS ==========
async function handleBookingSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const submitBtn = document.getElementById('booking-submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader" class="w-5 h-5 animate-spin"></i> Submitting...';

    const formData = {
        fullName: form.fullName.value,
        email: form.email.value,
        phone: form.phone.value,
        travelDate: form.travelDate.value,
        adults: form.adults.value,
        children: form.children.value,
        budgetRange: form.budgetRange.value,
        accommodationType: form.accommodationType.value,
        specialRequests: form.specialRequests.value,
        contactMethod: form.contactMethod.value
    };
    
    const packages = cart.map(item => ({
        package: {
            name: item.package.name,
            price: item.package.price,
            destination: item.package.destination,
            duration: item.package.duration
        },
        quantity: item.quantity
    }));

    const result = await submitBookingForm(formData, packages);

    if (result.success) {
        showToast('Booking request submitted successfully! Check your email for confirmation.', 'success');
        form.reset();
        clearCart();
        closeBookingModal();
    } else {
        showToast('Error submitting booking. Please try again or contact us directly.', 'error');
    }

    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i data-lucide="send" class="w-5 h-5"></i> Submit Booking';
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

async function handleContactSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalHTML = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader" class="w-5 h-5 animate-spin"></i> Sending...';

    const formData = {
        name: form.name.value,
        email: form.email.value,
        phone: form.phone.value,
        subject: form.subject.value,
        message: form.message.value
    };

    const result = await submitContactForm(formData);

    if (result.success) {
        showToast('Message sent successfully! We\'ll get back to you soon.', 'success');
        form.reset();
    } else {
        showToast('Error sending message. Please try again or contact us directly.', 'error');
    }

    submitBtn.disabled = false;
    submitBtn.innerHTML = originalHTML;
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// ========== TESTIMONIALS ==========
function renderTestimonial() {
    if (allTestimonials.length === 0) return;
    
    const testimonial = allTestimonials[currentTestimonialIndex];
    
    // Rating stars
    const ratingEl = document.getElementById('testimonial-rating');
    if (ratingEl) {
        ratingEl.innerHTML = '';
        for (let i = 0; i < 5; i++) {
            const star = document.createElement('i');
            star.setAttribute('data-lucide', 'star');
            star.className = i < testimonial.rating ? 'w-5 h-5 fill-yellow-400 text-yellow-400' : 'w-5 h-5 text-gray-300';
            ratingEl.appendChild(star);
        }
    }
    
    // Content
    document.getElementById('testimonial-text').textContent = `"${testimonial.text}"`;
    document.getElementById('testimonial-name').textContent = testimonial.name;
    document.getElementById('testimonial-location').textContent = testimonial.location;
    document.getElementById('testimonial-package').textContent = `Package: ${testimonial.package}`;
    document.getElementById('testimonial-date').textContent = testimonial.date;
    
    // Dots
    const dotsEl = document.getElementById('testimonial-dots');
    if (dotsEl) {
        dotsEl.innerHTML = '';
        allTestimonials.forEach((_, index) => {
            const dot = document.createElement('button');
            dot.className = `w-2.5 h-2.5 rounded-full transition-colors ${index === currentTestimonialIndex ? 'bg-blue-600' : 'bg-gray-300'}`;
            dot.onclick = () => {
                currentTestimonialIndex = index;
                renderTestimonial();
            };
            dotsEl.appendChild(dot);
        });
    }
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function nextTestimonial() {
    currentTestimonialIndex = (currentTestimonialIndex + 1) % allTestimonials.length;
    renderTestimonial();
}

function prevTestimonial() {
    currentTestimonialIndex = (currentTestimonialIndex - 1 + allTestimonials.length) % allTestimonials.length;
    renderTestimonial();
}

function startTestimonialAutoplay() {
    if (testimonialInterval) {
        clearInterval(testimonialInterval);
    }
    testimonialInterval = setInterval(nextTestimonial, 8000);
}



// ========== BACK TO TOP ==========
function setupBackToTop() {
    const backToTopBtn = document.getElementById('back-to-top');
    
    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 300) {
            backToTopBtn.classList.add('show');
        } else {
            backToTopBtn.classList.remove('show');
        }
    });
}

function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// ========== FORM DATA SUBMISSION TO GOOGLE SHEETS ==========
async function submitContactForm(formData) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
        
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain',
            },
            body: JSON.stringify({
                action: 'submitContact',
                data: formData
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
            const data = await response.json();
            return { success: true, data };
        } else {
            return { success: false, error: 'Server error' };
        }
    } catch (error) {
        console.error('Error submitting contact form:', error);
        // If timeout or network error, still show success to user
        // The form data should still have been sent
        return { success: true, note: 'Request sent (timeout/network)' };
    }
}

async function submitBookingForm(formData, packages) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
        
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain',
            },
            body: JSON.stringify({
                action: 'submitBooking',
                data: formData,
                packages: packages
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
            const data = await response.json();
            return { success: true, data };
        } else {
            return { success: false, error: 'Server error' };
        }
    } catch (error) {
        console.error('Error submitting booking form:', error);
        // If timeout or network error, still show success to user
        // The form data should still have been sent
        return { success: true, note: 'Request sent (timeout/network)' };
    }
}

// ========== TOAST ==========
function showToast(message, type) {
    Toastify({
        text: message,
        duration: 4000,
        gravity: 'top',
        position: 'right',
        className: type,
        stopOnFocus: true,
        style: {
            background: type === 'success' ? '#16a34a' : type === 'error' ? '#dc2626' : '#2563eb',
        }
    }).showToast();
}

// ========== INITIALIZE ==========
init();
// ========== CUSTOM GALLERY MODAL FUNCTIONS ==========

let currentGalleryData = null;
let currentImageIndex = 0;
let currentImages = [];

/**
 * Open gallery modal with tour details
 */
function openGalleryModal(galleryId) {
    // Find gallery item
    const item = allGalleryImages.find(g => g.id == galleryId);
    if (!item) return;
    
    currentGalleryData = item;
    currentImages = item.images || [];
    currentImageIndex = 0;
    
    // Populate modal
    document.getElementById('gallery-modal-title').textContent = item.title || '';
    document.getElementById('gallery-modal-destination').textContent = item.destination || '';
    document.getElementById('gallery-modal-year').textContent = item.year || '';
    document.getElementById('gallery-modal-tourtype').textContent = item.tourType || '';
    document.getElementById('gallery-modal-description').textContent = item.description || 'Beautiful tour experience';
    document.getElementById('gallery-modal-client').textContent = item.clientName || '';
    
    // Update image counter
    document.getElementById('gallery-total-count').textContent = currentImages.length;
    
    // Load first image
    updateGalleryImage(0);
    
    // Create thumbnails
    createGalleryThumbnails();
    
    // Show modal
    const modal = document.getElementById('gallery-modal');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
     // Mobile: Add touch event for swipe (optional enhancement)
    if (window.innerWidth <= 768) {
        let startX = 0;
        const imageEl = document.getElementById('gallery-modal-image');
        imageEl.addEventListener('touchstart', (e) => startX = e.touches[0].clientX, { passive: true });
        imageEl.addEventListener('touchend', (e) => {
            const endX = e.changedTouches[0].clientX;
            if (startX - endX > 50) nextGalleryImage(); // Swipe left
            if (endX - startX > 50) previousGalleryImage(); // Swipe right
        }, { passive: true });
    }
    // Initialize icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

/**
 * Close gallery modal
 */
function closeGalleryModal() {
    const modal = document.getElementById('gallery-modal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
    currentGalleryData = null;
    currentImages = [];
    currentImageIndex = 0;
}

/**
 * Update gallery image
 */
function updateGalleryImage(index) {
    if (index < 0 || index >= currentImages.length) return;
    
    currentImageIndex = index;
    const imageUrl = currentImages[index];
    
    document.getElementById('gallery-modal-image').src = imageUrl;
    document.getElementById('gallery-current-index').textContent = index + 1;
    
    // Update active thumbnail
    updateActiveThumbnail(index);
}

/**
 * Previous image
 */
function previousGalleryImage() {
    let newIndex = currentImageIndex - 1;
    if (newIndex < 0) newIndex = currentImages.length - 1;
    updateGalleryImage(newIndex);
}

/**
 * Next image
 */
function nextGalleryImage() {
    let newIndex = currentImageIndex + 1;
    if (newIndex >= currentImages.length) newIndex = 0;
    updateGalleryImage(newIndex);
}

/**
 * Create thumbnail strip
 */
function createGalleryThumbnails() {
    const container = document.getElementById('gallery-thumbnails');
    container.innerHTML = '';
    
    currentImages.forEach((imageUrl, index) => {
        const thumb = document.createElement('div');
        thumb.className = 'gallery-thumbnail' + (index === 0 ? ' active' : '');
        thumb.onclick = () => updateGalleryImage(index);
        
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = `Thumbnail ${index + 1}`;
        
        thumb.appendChild(img);
        container.appendChild(thumb);
    });
}

/**
 * Update active thumbnail
 */
function updateActiveThumbnail(index) {
    const thumbnails = document.querySelectorAll('.gallery-thumbnail');
    thumbnails.forEach((thumb, i) => {
        if (i === index) {
            thumb.classList.add('active');
        } else {
            thumb.classList.remove('active');
        }
    });
}

/**
 * Inquire about tour
 */
function inquireAboutTour() {
    closeGalleryModal();
    document.getElementById('contact-message').value = `I'm interested in the ${currentGalleryData.title} tour to ${currentGalleryData.destination}. Please send me more information.`;
    document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
}

/**
 * View similar packages
 */
function viewSimilarPackages() {
    closeGalleryModal();
    
    // Filter by destination
    if (currentGalleryData && currentGalleryData.destination) {
        const filter = document.getElementById('filter-destination');
        if (filter) {
            filter.value = currentGalleryData.destination;
            filterPackages();
        }
    }
    
    document.getElementById('packages').scrollIntoView({ behavior: 'smooth' });
}

/**
 * Download gallery image
 */
function downloadGalleryImage() {
    const imageUrl = currentImages[currentImageIndex];
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `rtw-tour-${currentGalleryData.destination}-${currentImageIndex + 1}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Update gallery grid rendering to use modal instead of GLightbox
// Find renderGalleryGrid function and update the onclick to use openGalleryModal

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('gallery-modal');
    if (modal.style.display === 'flex') {
        if (e.key === 'Escape') closeGalleryModal();
        if (e.key === 'ArrowLeft') previousGalleryImage();
        if (e.key === 'ArrowRight') nextGalleryImage();
    }
});

// ========== CHARACTER COUNTER FOR CONTACT FORM ==========

document.addEventListener('DOMContentLoaded', function() {
    const messageField = document.getElementById('contact-message');
    const counter = document.getElementById('message-counter');
    
    if (messageField && counter) {
        messageField.addEventListener('input', function() {
            const length = this.value.length;
            const maxLength = this.getAttribute('maxlength') || 500;
            counter.textContent = `${length} / ${maxLength}`;
            
            // Change color based on length
            if (length < 20) {
                counter.style.color = '#ef4444'; // Red
            } else if (length > maxLength - 50) {
                counter.style.color = '#f59e0b'; // Orange
            } else {
                counter.style.color = '#10b981'; // Green
            }
        });
    }
});

// ========== PACKAGE DETAILS MODAL ==========

function viewPackageDetails(packageId) {
    const pkg = allPackages.find(p => p.id === packageId);
    if (!pkg) return;
    
    const inclusionsList = pkg.inclusions ? pkg.inclusions.split(',').map(i => `<li class="flex items-start gap-2 text-sm"><span class="text-green-600 mt-1">✓</span><span>${i.trim()}</span></li>`).join('') : '<li class="text-gray-500">Not specified</li>';
    
    const exclusionsList = pkg.exclusions ? pkg.exclusions.split(',').map(e => `<li class="flex items-start gap-2 text-sm"><span class="text-red-600 mt-1">✗</span><span>${e.trim()}</span></li>`).join('') : '<li class="text-gray-500">Not specified</li>';
    
    const highlightsList = pkg.highlights ? pkg.highlights.split(',').map(h => `<li class="flex items-start gap-2 text-sm"><span class="text-blue-600 mt-1">•</span><span>${h.trim()}</span></li>`).join('') : '<li class="text-gray-500">Not specified</li>';
    
    const travelDates = pkg.travelDates ? pkg.travelDates.split('|').map(d => `<span class="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-semibold mr-2 mb-2">${d.trim()}</span>`).join('') : '<span class="text-gray-500">Contact for available dates</span>';
    
    const itineraryItems = pkg.itinerary ? pkg.itinerary.split('|').map((day, index) => `
        <div class="flex gap-4 pb-4 border-b border-gray-200 last:border-0">
            <div class="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">${index + 1}</div>
            <div class="flex-1">
                <div class="text-sm text-gray-700">${day.trim()}</div>
            </div>
        </div>
    `).join('') : '<div class="text-gray-500 text-sm">Itinerary details will be provided upon booking</div>';
    
    const modalHTML = `
        <div class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" id="package-details-modal" onclick="closePackageDetails(event)">
            <div class="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onclick="event.stopPropagation()">
                <!-- Header -->
                <div class="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 rounded-t-2xl z-10">
                    <div class="flex justify-between items-start gap-4">
                        <div class="flex-1">
                            <h2 class="text-2xl font-bold mb-2">${pkg.name}</h2>
                            <div class="flex flex-wrap items-center gap-4 text-sm opacity-90">
                                <span class="flex items-center gap-1">
                                    <i data-lucide="map-pin" class="w-4 h-4"></i> ${pkg.destination}
                                </span>
                                <span class="flex items-center gap-1">
                                    <i data-lucide="clock" class="w-4 h-4"></i> ${pkg.duration}
                                </span>
                                <span class="flex items-center gap-1">
                                    <i data-lucide="star" class="w-4 h-4 fill-yellow-400"></i> ${pkg.rating}
                                </span>
                                <span class="badge ${pkg.availability === 'Available' ? 'bg-green-500' : 'bg-amber-500'} text-white border-0">
                                    ${pkg.availability}
                                </span>
                            </div>
                        </div>
                        <button onclick="closePackageDetails()" class="flex-shrink-0 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors">
                            <i data-lucide="x" class="w-5 h-5"></i>
                        </button>
                    </div>
                </div>
                
                <!-- Image -->
                <div class="relative">
                    <img src="${pkg.image}" alt="${pkg.name}" class="w-full h-64 object-cover">
                    <div class="absolute bottom-4 right-4 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg">
                        <div class="text-sm opacity-90">Starting from</div>
                        <div class="text-3xl font-bold">₱${Number(pkg.price).toLocaleString()}</div>
                        <div class="text-xs opacity-90">per person</div>
                    </div>
                </div>
                
                <!-- Content -->
                <div class="p-6 space-y-6">
                    ${pkg.travelDates ? `<div><h3 class="flex items-center gap-2 text-lg font-bold mb-3 text-gray-900"><i data-lucide="calendar" class="w-5 h-5 text-blue-600"></i>Available Travel Dates</h3><div class="flex flex-wrap gap-2">${travelDates}</div></div>` : ''}
                    ${pkg.hotelDetails ? `<div class="bg-purple-50 border-l-4 border-purple-500 p-4 rounded-r-lg"><h3 class="flex items-center gap-2 font-bold mb-2 text-purple-900"><i data-lucide="hotel" class="w-5 h-5"></i>Accommodation</h3><p class="text-sm text-purple-800">${pkg.hotelDetails}</p></div>` : ''}
                    ${pkg.flightDetails ? `<div class="bg-cyan-50 border-l-4 border-cyan-500 p-4 rounded-r-lg"><h3 class="flex items-center gap-2 font-bold mb-2 text-cyan-900"><i data-lucide="plane" class="w-5 h-5"></i>Flight Information</h3><div class="text-sm text-cyan-800 space-y-1">${pkg.flightDetails.split('|').map(f => `<div>• ${f.trim()}</div>`).join('')}</div></div>` : ''}
                    ${pkg.visaRequirements ? `<div class="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg"><h3 class="flex items-center gap-2 font-bold mb-2 text-amber-900"><i data-lucide="file-text" class="w-5 h-5"></i>Visa Requirements</h3><p class="text-sm text-amber-800">${pkg.visaRequirements}</p></div>` : ''}
                    ${pkg.highlights ? `<div><h3 class="flex items-center gap-2 text-lg font-bold mb-3 text-gray-900"><i data-lucide="sparkles" class="w-5 h-5 text-blue-600"></i>Tour Highlights</h3><ul class="grid md:grid-cols-2 gap-2">${highlightsList}</ul></div>` : ''}
                    <div><h3 class="flex items-center gap-2 text-lg font-bold mb-3 text-gray-900"><i data-lucide="check-circle" class="w-5 h-5 text-green-600"></i>Inclusions</h3><ul class="space-y-2 bg-green-50 p-4 rounded-lg">${inclusionsList}</ul></div>
                    <div><h3 class="flex items-center gap-2 text-lg font-bold mb-3 text-gray-900"><i data-lucide="x-circle" class="w-5 h-5 text-red-600"></i>Exclusions</h3><ul class="space-y-2 bg-red-50 p-4 rounded-lg">${exclusionsList}</ul></div>
                    ${pkg.itinerary ? `<div><h3 class="flex items-center gap-2 text-lg font-bold mb-3 text-gray-900"><i data-lucide="map" class="w-5 h-5 text-blue-600"></i>Day-by-Day Itinerary</h3><div class="bg-gray-50 p-4 rounded-lg space-y-4">${itineraryItems}</div></div>` : ''}
                </div>
                
                <!-- Footer Actions -->
                <div class="bottom-0 bg-gray-50 p-6 rounded-b-2xl border-t-2 border-gray-200 flex flex-col sm:flex-row gap-3">
                    <button onclick="addToCartSingle('${pkg.id}')" class="flex-1 btn btn-primary py-4 text-lg justify-center"><i data-lucide="shopping-cart" class="w-5 h-5"></i>Add to Cart</button>
                    <button onclick="inquirePackage('${pkg.id}')" class="flex-1 btn btn-outline py-4 text-lg justify-center"><i data-lucide="message-circle" class="w-5 h-5"></i>Inquire Now</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.body.style.overflow = 'hidden';
    if (typeof lucide !== 'undefined') { lucide.createIcons(); }
}

function closePackageDetails(event) {
    if (!event || event.target.id === 'package-details-modal') {
        const modal = document.getElementById('package-details-modal');
        if (modal) { modal.remove(); document.body.style.overflow = 'auto'; }
    }
}

function inquirePackage(packageId) {
    const pkg = allPackages.find(p => p.id === packageId);
    if (!pkg) return;
    closePackageDetails();
    document.getElementById('contact-message').value = `I'm interested in the "${pkg.name}" package to ${pkg.destination}. Please send me more information about pricing, availability, and booking details.`;
    document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
}

// ========== TESTIMONIALS FUNCTIONS ==========

function renderTestimonial() {
    if (!allTestimonials || allTestimonials.length === 0) {
        console.log('No testimonials to render');
        return;
    }
    
    const testimonial = allTestimonials[currentTestimonialIndex];
    
    // Rating stars
    const ratingEl = document.getElementById('testimonial-rating');
    if (ratingEl) {
        ratingEl.innerHTML = '';
        for (let i = 0; i < 5; i++) {
            const star = document.createElement('i');
            star.setAttribute('data-lucide', 'star');
            star.className = i < testimonial.rating ? 'w-5 h-5 fill-yellow-400 text-yellow-400' : 'w-5 h-5 text-gray-300';
            ratingEl.appendChild(star);
        }
    }
    
    // Text
    const textEl = document.getElementById('testimonial-text');
    if (textEl) {
        textEl.textContent = `"${testimonial.text}"`;
    }
    
    // Name
    const nameEl = document.getElementById('testimonial-name');
    if (nameEl) {
        nameEl.textContent = testimonial.name;
    }
    
    // Location
    const locationEl = document.getElementById('testimonial-location');
    if (locationEl) {
        locationEl.textContent = testimonial.location;
    }
    
    // Package
    const packageEl = document.getElementById('testimonial-package');
    if (packageEl) {
        packageEl.textContent = testimonial.package || '';
    }
    
    // Date
    const dateEl = document.getElementById('testimonial-date');
    if (dateEl) {
        dateEl.textContent = testimonial.date || '';
    }
    
    // Update dots
    renderTestimonialDots();
    
    // Re-initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function renderTestimonialDots() {
    const dotsContainer = document.getElementById('testimonial-dots');
    if (!dotsContainer) return;
    
    dotsContainer.innerHTML = '';
    
    for (let i = 0; i < allTestimonials.length; i++) {
        const dot = document.createElement('button');
        dot.className = i === currentTestimonialIndex ? 
            'w-3 h-3 rounded-full bg-blue-600' : 
            'w-3 h-3 rounded-full bg-gray-300 hover:bg-gray-400';
        dot.setAttribute('aria-label', `View testimonial ${i + 1}`);
        dot.onclick = () => {
            currentTestimonialIndex = i;
            renderTestimonial();
            resetTestimonialAutoplay();
        };
        dotsContainer.appendChild(dot);
    }
}

function nextTestimonial() {
    if (allTestimonials.length === 0) return;
    currentTestimonialIndex = (currentTestimonialIndex + 1) % allTestimonials.length;
    renderTestimonial();
    resetTestimonialAutoplay();
}

function prevTestimonial() {
    if (allTestimonials.length === 0) return;
    currentTestimonialIndex = (currentTestimonialIndex - 1 + allTestimonials.length) % allTestimonials.length;
    renderTestimonial();
    resetTestimonialAutoplay();
}

function startTestimonialAutoplay() {
    if (allTestimonials.length <= 1) return;
    
    // Clear any existing interval
    if (testimonialInterval) {
        clearInterval(testimonialInterval);
    }
    
    // Auto-advance every 8 seconds
    testimonialInterval = setInterval(() => {
        nextTestimonial();
    }, 8000);
}

function resetTestimonialAutoplay() {
    if (testimonialInterval) {
        clearInterval(testimonialInterval);
    }
    startTestimonialAutoplay();
}

// ========== UPDATE STATS COUNTER WITH REAL DATA ==========

function updateStatsCounter() {
    // Wait for packages to load
    if (allPackages.length > 0) {
        // Count unique destinations
        const uniqueDestinations = new Set(allPackages.map(pkg => pkg.destination));
        const destinationCount = uniqueDestinations.size;
        
        // Total packages
        const packageCount = allPackages.length;
        
        // Update counters with IDs
        const tourPackagesCounter = document.getElementById('tour-packages-counter');
        const destinationsCounter = document.getElementById('destinations-counter');
        
        if (tourPackagesCounter) {
            tourPackagesCounter.setAttribute('data-target', packageCount);
        }
        
        if (destinationsCounter) {
            destinationsCounter.setAttribute('data-target', destinationCount);
        }
        
        console.log(`✅ Updated counters: ${destinationCount} destinations, ${packageCount} packages`);
        
        // Re-trigger the counter animation
        setupCounterAnimation();
    }
}

// ========== GALLERY RENDERING FUNCTIONS ==========

function renderGallery() {
    // Apply filters
    filteredGallery = allGalleryImages.filter(img => {
        const matchesYear = galleryFilterYear === 'all' || img.year == galleryFilterYear;
        const matchesDestination = galleryFilterDestination === 'all' || img.destination === galleryFilterDestination;
        const matchesTourType = galleryFilterTourType === 'all' || img.tourType === galleryFilterTourType;
        return matchesYear && matchesDestination && matchesTourType;
    });
    
    // Update results count
    const resultsCount = document.getElementById('gallery-results-count');
    if (resultsCount) {
        resultsCount.textContent = `Showing ${filteredGallery.length} ${filteredGallery.length === 1 ? 'image' : 'images'}`;
    }
    
    // Calculate pagination
    const totalPages = Math.ceil(filteredGallery.length / galleryPerPage);
    const startIndex = (currentGalleryPage - 1) * galleryPerPage;
    const endIndex = startIndex + galleryPerPage;
    const pageImages = filteredGallery.slice(startIndex, endIndex);
    
    // Render gallery grid
    const galleryGrid = document.getElementById('gallery-grid');
    if (!galleryGrid) return;
    
    if (pageImages.length === 0) {
        galleryGrid.innerHTML = '<div class="col-span-full text-center py-12 text-gray-500"><i data-lucide="image-off" class="w-12 h-12 mx-auto mb-4"></i><p>No images found</p></div>';
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }
    
    galleryGrid.innerHTML = pageImages.map(img => `
        <div class="gallery-item" onclick="openGalleryModal('${img.id}')">
            <img src="${img.thumbnail}" alt="${img.title}" loading="lazy">
            <div class="gallery-item-overlay">
                <div class="gallery-item-title">${img.title}</div>
                <div class="gallery-item-meta">${img.destination} • ${img.year}</div>
                ${img.images && img.images.length > 1 ? `<div class="gallery-item-count"><i data-lucide="images" class="w-3 h-3"></i> ${img.images.length} photos</div>` : ''}
            </div>
        </div>
    `).join('');
    
    // Render pagination
    renderGalleryPagination(totalPages);
    
    // Re-initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function renderGalleryPagination(totalPages) {
    const paginationContainer = document.getElementById('gallery-pagination');
    if (!paginationContainer) return;
    
    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }
    
    let paginationHTML = `
        <button class="pagination-btn" onclick="changeGalleryPage(${currentGalleryPage - 1})" ${currentGalleryPage === 1 ? 'disabled' : ''}>
            <i data-lucide="chevron-left" class="w-4 h-4"></i>
        </button>
    `;
    
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentGalleryPage - 1 && i <= currentGalleryPage + 1)) {
            paginationHTML += `
                <button class="pagination-btn ${i === currentGalleryPage ? 'active' : ''}" onclick="changeGalleryPage(${i})">
                    ${i}
                </button>
            `;
        } else if (i === currentGalleryPage - 2 || i === currentGalleryPage + 2) {
            paginationHTML += '<span class="pagination-btn" disabled>...</span>';
        }
    }
    
    paginationHTML += `
        <button class="pagination-btn" onclick="changeGalleryPage(${currentGalleryPage + 1})" ${currentGalleryPage === totalPages ? 'disabled' : ''}>
            <i data-lucide="chevron-right" class="w-4 h-4"></i>
        </button>
    `;
    
    paginationContainer.innerHTML = paginationHTML;
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function changeGalleryPage(page) {
    const totalPages = Math.ceil(filteredGallery.length / galleryPerPage);
    if (page < 1 || page > totalPages) return;
    currentGalleryPage = page;
    renderGallery();
    document.getElementById('gallery').scrollIntoView({ behavior: 'smooth', block: 'start' });
}