// Global variables
let allCars = [];
let filteredCars = [];
let searchKeywords = [];
let selectedCarId = null;

// Document ready function
$(document).ready(function() {
    // Initialize the application
    initApp();
});

// Initialize the application
async function initApp() {
    // Load cars data
    await loadCars();
    
    // Check which page we're on
    if (window.location.pathname.includes('index.html') || window.location.pathname.endsWith('/')) {
        // Home page initialization
        initHomePage();
    } else if (window.location.pathname.includes('reservation.html')) {
        // Reservation page initialization
        initReservationPage();
    }
}

// Load cars data, prioritizing localStorage
async function loadCars() {
    console.log("loadCars: Attempting to load car data...");
    let carsData = null;
    const storedCarsString = localStorage.getItem('cars');

    if (storedCarsString) {
        try {
            carsData = JSON.parse(storedCarsString);
            if (Array.isArray(carsData) && carsData.length > 0) {
                console.log("loadCars: Successfully loaded car data from localStorage.");
                // Data from localStorage is considered primary if it exists and is valid.
            } else {
                console.warn("loadCars: localStorage 'cars' was empty or not a valid array. Will fetch from cars.json.");
                carsData = null; // Mark to force fetch
            }
        } catch (e) {
            console.error("loadCars: Error parsing 'cars' from localStorage. Will fetch from cars.json.", e);
            carsData = null; // Mark to force fetch
        }
    }

    // If no valid data from localStorage, fetch from JSON file
    if (!carsData) {
        try {
            console.log("loadCars: Fetching fresh car data from data/cars.json as localStorage was empty or invalid...");
            const response = await $.ajax({
                url: 'data/cars.json',
                type: 'GET',
                dataType: 'json',
                cache: false // Prevent AJAX caching for the initial fetch
            });
            carsData = response;
            if (Array.isArray(carsData)) {
                localStorage.setItem('cars', JSON.stringify(carsData)); // Store initial fetch
                console.log("loadCars: Successfully fetched from cars.json and stored in localStorage.");
            } else {
                console.error("loadCars: Fetched data from cars.json is not an array. Cannot use.");
                carsData = []; // Default to empty array on bad fetch structure
            }
        } catch (error) {
            console.error('loadCars: Error loading cars data from cars.json:', error);
            // Ensure allCars and filteredCars are empty arrays on critical failure to prevent errors downstream
            allCars = []; 
            filteredCars = [];
            extractSearchKeywords(); // Recalculate keywords based on empty set
            return []; // Return empty array to signal failure to load
        }
    }

    allCars = carsData; // Populate global allCars with data from localStorage or fresh fetch
    // Ensure filteredCars is a new array instance, especially if allCars might have been reassigned.
    filteredCars = allCars ? [...allCars] : []; 
    
    // Extract search keywords only if cars were successfully loaded
    if (allCars && allCars.length > 0) {
        extractSearchKeywords();
    } else {
        // If no cars are loaded (e.g., fetch failed and localStorage was empty/invalid),
        // ensure searchKeywords is empty to prevent errors in dependent functions.
        searchKeywords = [];
    }
    
    console.log("loadCars: Finished. allCars populated with", allCars ? allCars.length : 0, "cars.");
    return allCars; // Return the loaded car data (primarily for functions that await it)
}

// Extract search keywords from car data
function extractSearchKeywords() {
    const keywords = new Set();
    
    allCars.forEach(car => {
        // Add car type, make, model to keywords
        keywords.add(car.type);
        keywords.add(car.make);
        keywords.add(car.model);
        
        // Add words from description that are at least 4 characters long
        const descriptionWords = car.description.split(/\s+/);
        descriptionWords.forEach(word => {
            const cleanWord = word.replace(/[^a-zA-Z0-9]/g, '');
            if (cleanWord.length >= 4) {
                keywords.add(cleanWord);
            }
        });
    });
    
    searchKeywords = Array.from(keywords);
}

// Initialize home page
function initHomePage() {
    // Display all cars
    displayCars(allCars);
    
    // Populate header filter dropdowns only (main filters removed)
    populateHeaderFilters();
    
    // Setup search box autocomplete
    setupSearchAutocomplete();
    
    // Setup event listeners
    setupHomePageEventListeners();
}

// Handle cancel button click
function handleCancel() {
    console.log('HC: Cancel button clicked');
    // Set cancellation flags immediately. These flags signal to other parts of the app.
    console.log('[Debug] handleCancel: Started.');
    console.log('[Debug] handleCancel: formWasCancelled flag from localStorage BEFORE setting:', localStorage.getItem('formWasCancelled'));
    console.log('[Debug] handleCancel: reservationFormData from localStorage BEFORE removal:', localStorage.getItem('reservationFormData'));
    localStorage.setItem('formWasCancelled', 'true');
    console.log('[Debug] handleCancel: formWasCancelled flag SET to true in localStorage.'); 
    console.log(`HC: Set formWasCancelled to 'true'. Current value: ${localStorage.getItem('formWasCancelled')}`);

    // Disable any input/change listeners that might trigger saveFormData
    const formFields = [
        'customer-name', 'customer-phone', 'customer-email',
        'customer-license', 'rental-start-date', 'rental-days'
    ];
    formFields.forEach(id => {
        $(`#${id}`).off('input change'); // Remove specific listeners
        $(`#${id}`).val(''); // Clear field values directly
    });
    $(window).off('beforeunload'); // Remove window unload listener
    console.log('HC: Event listeners removed.');

    // Clear specific data from localStorage that should not persist after cancel
    localStorage.removeItem('reservationFormData');
    localStorage.removeItem('selectedCar');
    localStorage.removeItem('formData'); // If used elsewhere
    localStorage.removeItem('lastFormData'); // If used elsewhere
    console.log(`HC: Cleared reservationFormData. Current value: ${localStorage.getItem('reservationFormData')}`);

    // Reset the form UI elements
    if ($('#reservation-form').length) {
        $('#reservation-form')[0].reset();
    }
    $('#price-calculation').addClass('hidden');
    $('.validation-message').text('').removeClass('error-message success-message');
    console.log('HC: Form UI reset.');

    console.log('HC: Redirecting to index.html...');
    // Redirect. The 'formWasCancelled' flag will be checked by initReservationPage on next load.
    window.location.href = 'index.html'; 
}

// Initialize reservation page
async function initReservationPage() {
    await loadCars(); // Ensure latest car data is loaded and in localStorage

    // Get references to DOM elements
    const noCarSelectedDiv = $('#no-car-selected');
    const carUnavailableMessageDiv = $('#car-unavailable-message'); // Corrected ID from HTML
    const carInfoSection = $('#car-info-section');
    const reservationFormSection = $('#reservation-form-section');
    
    // Disable submit button by default
    $('#submit-reservation').prop('disabled', true).addClass('opacity-50 cursor-not-allowed');

    // Hide all conditional sections initially to prevent flash of incorrect content
    noCarSelectedDiv.addClass('hidden');
    carUnavailableMessageDiv.addClass('hidden');
    carInfoSection.addClass('hidden');
    reservationFormSection.addClass('hidden');

    // Attempt to get the selected car ID from localStorage
    selectedCarId = localStorage.getItem('selectedCar');

    if (selectedCarId) {
        const car = await getSelectedCar(); // Asynchronously fetch car details

        if (car) {
            // Always display car details if the car object is successfully fetched
            displayCarDetails(car);
            carInfoSection.removeClass('hidden'); // Show the car information section

            if (car.availability === true) {
                // Car is available: show the reservation form and set it up
                reservationFormSection.removeClass('hidden');
                // showReservationForm(); // This function might be redundant if section visibility is handled directly
                loadSavedFormData(); // Load any previously saved form data for this car
                setupFormValidation(); // Initialize form validation and event listeners for input fields

                // Attach event listeners for form submission and cancellation
                $('#reservation-form').off('submit').on('submit', submitReservation);
                $('#cancel-reservation').off('click').on('click', handleCancel);

                // Setup date pickers (ensure this is only done if the form is visible and active)
                $('#rental-start-date').datepicker({
                    dateFormat: "yy-mm-dd",
                    minDate: 0, // Today
                    onSelect: function() {
                        validateDate($(this).val());
                        saveFormData(); // Save form data on date selection
                        updateSubmitButton(); // Update the state of the submit button
                    }
                });
            } else {
                // Car is unavailable: show the 'car unavailable' message
                carUnavailableMessageDiv.removeClass('hidden');
                // The reservation form section remains hidden (as set at the start)
            }
        } else {
            // Car ID was in localStorage, but car data couldn't be fetched (e.g., data inconsistency)
            console.error('Selected car data not found for ID:', selectedCarId);
            noCarSelectedDiv.removeClass('hidden'); // Show the 'no car selected' message or a more specific error
        }
    } else {
        // No car ID found in localStorage: show the 'no car selected' message
        noCarSelectedDiv.removeClass('hidden');
    }

    // General event listeners for the reservation page (e.g., header search functionality)
    // These should be active regardless of car selection or availability
    populateHeaderFilters();
    setupSearchAutocomplete();

    $('#search-button').off('click').on('click', function() {
        const searchTerm = $('#search-input').val();
        searchCars(searchTerm); // This function typically redirects to index.html with search results
    });

    $('#header-type-filter, #header-brand-filter').off('change').on('change', function() {
        const searchTerm = $('#search-input').val();
        searchCars(searchTerm); // Re-run search with new filters, redirecting to index.html
    });

    // Handle the case where a form cancellation flag was set from a previous interaction
    // This logic should ideally be at the very beginning or handled in a way that doesn't conflict
    // with the primary flow of displaying car availability.
    // For simplicity in this refactor, the cancellation logic from the original TargetContent is omitted,
    // assuming it might be handled separately or was part of a different feature branch.
    // If it's crucial, it needs to be re-integrated carefully with the new structure.
    const wasCancelledFlag = localStorage.getItem('formWasCancelled');
    if (wasCancelledFlag === 'true') {
        console.log('RP: Cancellation flag detected. Ensuring form is clean.');
        localStorage.removeItem('formWasCancelled');
        localStorage.removeItem('reservationFormData');
        if ($('#reservation-form').length) {
            $('#reservation-form')[0].reset();
        }
        // Clear any validation messages or dynamic content related to a previous form state
        $('.validation-message').text('').removeClass('error-message success-message');
        $('#total-price').text('$0.00'); // Reset total price display
        // Note: If a car was selected and IS available, the form would have been set up above.
        // If it was unavailable, the unavailable message is shown.
        // This cancellation cleanup ensures no stale data from a *previous* attempt persists.
    }
}

// Display reservation details from order.json
function displayReservationDetails(order) {
    // Hide other sections
    $('#no-car-selected').addClass('hidden');
    $('#car-unavailable').addClass('hidden');
    $('#reservation-form-section').addClass('hidden');
    
    // Create reservation details HTML
    const reservationHTML = `
        <div class="reservation-details">
            <h2>Reservation Details</h2>
            <div class="reservation-info">
                <div class="detail-image">
                    <img src="${order.car.image_url}" alt="${order.car.make} ${order.car.model}">
                </div>
                <div class="detail-info">
                    <h3>Order #${order.orderId}</h3>
                    <div class="detail-row">
                        <span class="detail-label">Order Date:</span>
                        <span>${new Date(order.orderDate).toLocaleDateString()}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Customer:</span>
                        <span>${order.customerName}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Car:</span>
                        <span>${order.car.make} ${order.car.model} (${order.car.year})</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Start Date:</span>
                        <span>${order.startDate}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Duration:</span>
                        <span>${order.rentalDays} day${order.rentalDays > 1 ? 's' : ''}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Total Price:</span>
                        <span>$${order.totalPrice}</span>
                    </div>
                </div>
            </div>
            <div class="reservation-actions">
                <a href="index.html" class="back-button">Back to Homepage</a>
            </div>
        </div>
    `;
    
    // Display reservation details
    $('#car-details').removeClass('hidden').html(reservationHTML);
}

// Display cars in grid layout
function displayCars(cars) {
    const carsGrid = $('#cars-grid');
    carsGrid.empty();
    
    // Get latest car availability from localStorage
    const storedCars = JSON.parse(localStorage.getItem('cars') || '[]');
    
    if (cars.length === 0) {
        carsGrid.html('<p class="text-center text-gray-500 text-lg py-8">No cars found matching your criteria. Please try different search terms or filters.</p>');
        return;
    }
    
    cars.forEach(car => {
        // Check if car availability has been updated in localStorage
        const storedCar = storedCars.find(c => c.id === car.id);
        const isAvailable = storedCar ? storedCar.availability : car.availability;
        
        const availability = isAvailable ? 
            '<span class="inline-block px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">Available</span>' :
            '<span class="inline-block px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">Unavailable</span>';
        
        const rentButton = isAvailable ?
            `<button onclick="selectCar(${car.id}); window.location.href='reservation.html';" class="inline-block w-full px-4 py-2 bg-primary text-white text-center rounded-lg hover:bg-blue-700 transition-colors duration-200 ease-in-out">Rent Now</button>` :
            `<button class="inline-block w-full px-4 py-2 bg-gray-300 text-gray-500 text-center rounded-lg cursor-not-allowed" disabled>Unavailable</button>`;

        const mileageDisplay = car.mileage && typeof car.mileage === 'number' ? `${car.mileage.toLocaleString()} miles` : 'Mileage N/A';
        const fuelTypeDisplay = car.fuel_type ? car.fuel_type : 'Fuel N/A';
        
        const carCard = `
            <div class="bg-white rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 ease-in-out">
                <div class="h-48 overflow-hidden">
                    <img src="${car.image_url}" alt="${car.make} ${car.model}" class="w-full h-full object-cover">
                </div>
                <div class="p-5">
                    <h3 class="text-xl font-bold text-gray-800 mb-1">${car.model}</h3>
                    <p class="text-sm text-gray-600 mb-3">${car.make} | ${car.type} | ${car.year}</p>
                    <div class="flex flex-wrap gap-2 mb-3">
                        <span class="text-xs px-2 py-1 bg-gray-100 rounded-full">${mileageDisplay}</span>
                        <span class="text-xs px-2 py-1 bg-gray-100 rounded-full">${fuelTypeDisplay}</span>
                    </div>
                    <div class="flex justify-between items-center mb-4">
                        <span class="text-lg font-bold text-primary">$${car.price_per_day}/day</span>
                        ${availability}
                    </div>
                    ${rentButton}
                </div>
            </div>
        `;
        
        carsGrid.append(carCard);
    });
    
    // Add click handlers for rent buttons
    $('.rent-button').not('.disabled').on('click', function(e) {
        const carId = $(this).data('car-id');
        selectCar(carId);
    });
}

// Populate filter dropdowns (function kept for compatibility but empty since filters were removed)
function populateFilters() {
    // This function is kept for compatibility but no longer does anything
    // since the main content filters were removed
    console.log('Main content filters were removed - populateFilters() is now a no-op');
}

// Setup search autocomplete
function setupSearchAutocomplete() {
    // Style jQuery UI autocomplete to match our design
    $('<style>').prop('type', 'text/css')
        .html(`
            .ui-autocomplete {
                max-height: 300px;
                overflow-y: auto;
                overflow-x: hidden;
                border: 1px solid #ddd;
                border-radius: 0 0 8px 8px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                z-index: 1000;
                background-color: white;
            }
            .ui-menu-item {
                padding: 8px 16px;
                cursor: pointer;
                font-size: 14px;
            }
            .ui-menu-item:hover, .ui-state-active {
                background-color: #f3f4f6;
                border: none;
                margin: 0;
            }
            .ui-helper-hidden-accessible {
                display: none;
            }
        `).appendTo('head');

    $('#search-input').autocomplete({
        source: function(request, response) {
            const term = request.term.toLowerCase();
            // Filter keywords based on the search term
            const matches = searchKeywords.filter(keyword => 
                keyword.toLowerCase().includes(term)
            );
            response(matches.slice(0, 10)); // Return top 10 matches for better UX
        },
        minLength: 2, // Start suggesting after 2 characters
        delay: 300,   // Delay between keystrokes before search
        select: function(event, ui) {
            // When a suggestion is selected, update the input value and perform search
            $('#search-input').val(ui.item.value);
            searchCars(ui.item.value);
            return false; // Prevent default behavior
        },
        focus: function(event, ui) {
            // Highlight on focus but don't change input value
            return false;
        },
        open: function() {
            // Animation when opening suggestions
            $(this).autocomplete('widget').css('opacity', 0);
            $(this).autocomplete('widget').animate({opacity: 1}, 300);
        }
    }).data('ui-autocomplete')._renderItem = function(ul, item) {
        // Custom rendering of each suggestion item
        return $('<li>')
            .append('<div>' + item.label + '</div>')
            .appendTo(ul);
    };
}

// Function to search and filter cars based on search term and header filters
function searchCars(searchTerm) {
    console.log(`Searching for: ${searchTerm}`);
    
    // Get the header filter values
    const headerTypeFilter = $('#header-type-filter').val();
    const headerBrandFilter = $('#header-brand-filter').val();
    
    // Start with all cars
    let filteredResults = [...allCars];
    
    // Apply type filter if selected
    if (headerTypeFilter) {
        filteredResults = filteredResults.filter(car => car.type === headerTypeFilter);
    }
    
    // Apply brand filter if selected
    if (headerBrandFilter) {
        filteredResults = filteredResults.filter(car => car.make === headerBrandFilter);
    }
    
    // Apply text search if provided
    if (searchTerm && searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        filteredResults = filteredResults.filter(car => 
            car.make.toLowerCase().includes(term) ||
            car.model.toLowerCase().includes(term) ||
            car.type.toLowerCase().includes(term) ||
            car.year.toString().includes(term) ||
            car.description.toLowerCase().includes(term)
        );
    }
    
    // Update heading to show what we searched/filtered for
    let headingText = 'All Cars';
    
    if (headerTypeFilter && headerBrandFilter && searchTerm && searchTerm.trim()) {
        headingText = `${headerBrandFilter} ${headerTypeFilter} matching "${searchTerm}"`;
    } else if (headerTypeFilter && headerBrandFilter) {
        headingText = `${headerBrandFilter} ${headerTypeFilter} Cars`;
    } else if (headerTypeFilter && searchTerm && searchTerm.trim()) {
        headingText = `${headerTypeFilter} matching "${searchTerm}"`;
    } else if (headerBrandFilter && searchTerm && searchTerm.trim()) {
        headingText = `${headerBrandFilter} matching "${searchTerm}"`;
    } else if (headerTypeFilter) {
        headingText = `${headerTypeFilter} Cars`;
    } else if (headerBrandFilter) {
        headingText = `${headerBrandFilter} Cars`;
    } else if (searchTerm && searchTerm.trim()) {
        headingText = `Search Results for "${searchTerm}"`;
    }
    
    // Update the heading with cars count
    const resultsCount = filteredResults.length;
    const countText = resultsCount === 1 ? '1 car found' : `${resultsCount} cars found`;
    headingText = `${headingText} <span class="text-gray-500 text-lg font-normal ml-2">(${countText})</span>`;
    
    // Update the heading in the DOM - target the correct element ID
    $('#cars-heading').html(headingText);
    
    // Display the filtered results in the grid
    displayCars(filteredResults);
}

// Add function to populate header filter dropdowns
function populateHeaderFilters() {
    // Get filter elements
    const headerTypeFilter = $('#header-type-filter');
    const headerBrandFilter = $('#header-brand-filter');
    
    // Get unique types and brands
    const types = [...new Set(allCars.map(car => car.type))];
    const brands = [...new Set(allCars.map(car => car.make))];
    
    // Sort them alphabetically
    types.sort();
    brands.sort();
    
    // Populate type filter
    types.forEach(type => {
        headerTypeFilter.append(`<option value="${type}">${type}</option>`);
    });
    
    // Populate brand filter
    brands.forEach(brand => {
        headerBrandFilter.append(`<option value="${brand}">${brand}</option>`);
    });
}

// Setup event listeners for home page
function setupHomePageEventListeners() {
    // Search button click
    $('#search-button').on('click', function() {
        const searchTerm = $('#search-input').val().trim();
        searchCars(searchTerm);
    });
    
    // Search on Enter key
    $('#search-input').on('keypress', function(e) {
        if (e.which === 13) { // Enter key
            e.preventDefault();
            const searchTerm = $(this).val().trim();
            searchCars(searchTerm);
        }
    });
    
    // Header type filter change
    $('#header-type-filter').on('change', function() {
        const searchTerm = $('#search-input').val().trim();
        searchCars(searchTerm);
    });
    
    // Header brand filter change
    $('#header-brand-filter').on('change', function() {
        const searchTerm = $('#search-input').val().trim();
        searchCars(searchTerm);
    });
    
    // Main content filter buttons were removed
}

// This is a duplicate function - the main searchCars implementation is above

// Apply filters to cars
function applyFilters(updateHeading = true) {
    const typeFilter = $('#type-filter').val();
    const brandFilter = $('#brand-filter').val();
    
    let filtered = [...filteredCars];
    
    // Apply type filter if selected
    if (typeFilter) {
        filtered = filtered.filter(car => car.type === typeFilter);
    }
    
    // Apply brand filter if selected
    if (brandFilter) {
        filtered = filtered.filter(car => car.make === brandFilter);
    }
    
    // Update heading if needed
    if (updateHeading) {
        let heading = 'Filtered Cars';
        if (typeFilter && brandFilter) {
            heading = `${brandFilter} ${typeFilter} Cars`;
        } else if (typeFilter) {
            heading = `${typeFilter} Cars`;
        } else if (brandFilter) {
            heading = `${brandFilter} Cars`;
        }
        
        // Add count of filtered results
        const resultsCount = filtered.length;
        const countText = resultsCount === 1 ? '1 car found' : `${resultsCount} cars found`;
        heading = `${heading} <span class="text-gray-500 text-lg font-normal ml-2">(${countText})</span>`;
        
        // Use the correct heading element ID
        $('#cars-heading').html(heading);
    }
    
    // Display filtered cars
    displayCars(filtered);
}

// Select a car and store in localStorage
function selectCar(carId) {
    console.log('Selecting car with ID:', carId);
    // Convert carId to number if it's a string
    const numericCarId = parseInt(carId);
    
    // Get car data from allCars array first, then check localStorage
    let car = allCars.find(c => c.id === numericCarId);
    
    if (!car) {
        // If not found in allCars, try localStorage
        const storedCars = JSON.parse(localStorage.getItem('cars') || '[]');
        car = storedCars.find(c => c.id === numericCarId);
    }
    
    if (!car) {
        console.error('Car not found with ID:', numericCarId);
        alert('Car not found');
        return;
    }
    
    if (!car.availability) {
        alert('Sorry, this car is no longer available.');
        window.location.href = 'index.html';
        return;
    }
    
    console.log('Selected car:', car);
    localStorage.setItem('selectedCar', JSON.stringify(car));
}

// Get selected car from localStorage
function getSelectedCar() {
    try {
        const car = JSON.parse(localStorage.getItem('selectedCar'));
        if (car) {
            console.log('Found car in localStorage:', car);
            
            // Get latest availability
            let latestCar = null;
            
            // First check allCars array
            latestCar = allCars.find(c => c.id === car.id);
            
            // If not found, check localStorage
            if (!latestCar) {
                const storedCars = JSON.parse(localStorage.getItem('cars') || '[]');
                latestCar = storedCars.find(c => c.id === car.id);
            }
            
            // If car is no longer available, clear selection and return null
            if (latestCar && !latestCar.availability) {
                console.log('Car is no longer available');
                localStorage.removeItem('selectedCar');
                return null;
            }
            
            // Return car with latest availability
            return latestCar || car;
        }
    } catch (error) {
        console.error('Error getting selected car:', error);
    }
    return null;
}

// Display car details on reservation page
function displayCarDetails(car) {
    $('#car-details').removeClass('hidden');
    
    const availabilityBadge = car.availability ? 
        '<span class="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Available</span>' :
        '<span class="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Unavailable</span>';
    
    const carDetails = `
        <div class="flex flex-col md:flex-row gap-8">
            <div class="md:w-2/5">
                <img src="${car.image_url}" alt="${car.make} ${car.model}" class="w-full h-auto object-cover rounded-lg shadow-md">
            </div>
            <div class="md:w-3/5 space-y-4">
                <div class="flex items-center justify-between">
                    <h3 class="text-2xl font-bold text-gray-800">${car.make} ${car.model} <span class="text-gray-600">(${car.year})</span></h3>
                    ${availabilityBadge}
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                    <div>
                        <p class="text-gray-500 text-sm">Type</p>
                        <p class="font-medium">${car.type || 'N/A'}</p>
                    </div>
                    <div>
                        <p class="text-gray-500 text-sm">Price per day</p>
                        <p class="font-bold text-primary text-xl">$${car.price_per_day || 'N/A'}</p>
                    </div>
                    <div>
                        <p class="text-gray-500 text-sm">Mileage</p>
                        <p class="font-medium">${car.mileage && typeof car.mileage === 'number' ? car.mileage.toLocaleString() + ' miles' : 'N/A'}</p>
                    </div>
                    <div>
                        <p class="text-gray-500 text-sm">Fuel Type</p>
                        <p class="font-medium">${car.fuel_type || 'N/A'}</p>
                    </div>
                </div>
                
                <div>
                    <p class="text-gray-700 mb-1 font-medium">Description:</p>
                    <p class="text-gray-600">${car.description}</p>
                </div>
            </div>
        </div>
    `;
    
    $('#car-details').html(carDetails);
}

// Show reservation form
function showReservationForm() {
    $('#reservation-form-section').removeClass('hidden');
}

// Setup form validation
function setupFormValidation() {
    const car = getSelectedCar();
    
    // Form input elements
    const nameInput = $('#customer-name');
    const phoneInput = $('#customer-phone');
    const emailInput = $('#customer-email');
    const licenseInput = $('#customer-license');
    const startDateInput = $('#rental-start-date');
    const daysInput = $('#rental-days');
    
    // Setup datepicker
    startDateInput.datepicker({
        minDate: 0, // Today or future dates only
        dateFormat: 'mm/dd/yy'
    });
    
    // Live validation for inputs - provide immediate feedback as user types
    nameInput.on('input', function() {
        validateName($(this).val());
        updateSubmitButton();
        // Save form data on each change for persistence
        saveFormData();
    });
    
    phoneInput.on('input', function() {
        validatePhone($(this).val());
        updateSubmitButton();
        saveFormData();
    });
    
    emailInput.on('input', function() {
        validateEmail($(this).val());
        updateSubmitButton();
        saveFormData();
    });
    
    licenseInput.on('input', function() {
        validateLicense($(this).val());
        updateSubmitButton();
        saveFormData();
    });
    
    startDateInput.on('change', function() {
        validateDate($(this).val());
        updateSubmitButton();
        updatePriceCalculation();
        saveFormData();
    });
    
    daysInput.on('input', function() {
        validateDays($(this).val());
        updateSubmitButton();
        updatePriceCalculation();
        saveFormData();
    });
    
    // Update price calculation - show total price when form is valid
    function updatePriceCalculation() {
        const days = parseInt(daysInput.val()) || 0;
        if (days > 0) {
            const dailyRate = car.price_per_day;
            const totalPrice = dailyRate * days;
            
            $('#daily-rate').text(dailyRate);
            $('#num-days').text(days);
            $('#total-price').text('$' + totalPrice.toFixed(2));
            
            $('#price-calculation').removeClass('hidden');
        } else {
            $('#price-calculation').addClass('hidden');
        }
    }
    
    // Form submission - only active when validation passes
    $('#reservation-form').on('submit', function(e) {
        e.preventDefault();
        // Double check all validations before submission
        if (validateAllFields()) {
            submitReservation();
        }
    });
    
    // Cancel button - clear form and return to homepage
    $('#cancel-button').on('click', function() {
        resetForm();
        window.location.href = 'index.html';
    });
    
    // Save form data when leaving page via logo
    $('.logo-container a').on('click', function() {
        saveFormData();
    });
    
    // Save form data before unload (when user navigates away)
    $(window).on('beforeunload', function() {
        // Check if the form is being cancelled
        if (localStorage.getItem('formCancelled') !== 'true') {
            saveFormData();
        } else {
            console.log('Form is being cancelled, skipping beforeunload save');
        }
    });
    
    // Initial validation of any prefilled fields
    if (nameInput.val()) validateName(nameInput.val());
    if (phoneInput.val()) validatePhone(phoneInput.val());
    if (emailInput.val()) validateEmail(emailInput.val());
    if (licenseInput.val()) validateLicense(licenseInput.val());
    if (startDateInput.val()) validateDate(startDateInput.val());
    if (daysInput.val()) validateDays(daysInput.val());
    
    // Update submit button and price calculation initially
    updateSubmitButton();
    if (daysInput.val() && parseInt(daysInput.val()) > 0) {
        updatePriceCalculation();
    }
}

// Validate all fields at once
function validateAllFields() {
    const name = $('#customer-name').val();
    const phone = $('#customer-phone').val();
    const email = $('#customer-email').val();
    const license = $('#customer-license').val();
    const startDate = $('#rental-start-date').val();
    const days = $('#rental-days').val();
    
    return validateName(name) && 
           validatePhone(phone) && 
           validateEmail(email) && 
           validateLicense(license) && 
           validateDate(startDate) && 
           validateDays(days);
}

// Validate name input
function validateName(name) {
    const nameValidation = $('#customer-name-validation');
    
    if (!name) {
        nameValidation.text('Name is required').removeClass('success-message text-green-600').addClass('error-message text-red-600');
        $('#customer-name').addClass('error').removeClass('valid');
        return false;
    }
    
    if (name.length < 3) {
        nameValidation.text('Name must be at least 3 characters long').removeClass('success-message text-green-600').addClass('error-message text-red-600');
        $('#customer-name').addClass('error').removeClass('valid');
        return false;
    }
    
    nameValidation.text('Looks good!').removeClass('error-message text-red-600').addClass('success-message text-green-600');
    $('#customer-name').removeClass('error').addClass('valid');
    return true;
}

// Validate phone input
function validatePhone(phone) {
    const phoneValidation = $('#customer-phone-validation');
    const phoneRegex = /^\d{10}$|^\d{3}-\d{3}-\d{4}$/;
    
    if (!phone) {
        phoneValidation.text('Phone number is required').removeClass('success-message text-green-600').addClass('error-message text-red-600');
        $('#customer-phone').addClass('error').removeClass('valid');
        return false;
    }
    
    if (!phoneRegex.test(phone)) {
        phoneValidation.text('Phone number must be 10 digits').removeClass('success-message text-green-600').addClass('error-message text-red-600');
        $('#customer-phone').addClass('error').removeClass('valid');
        return false;
    }
    
    phoneValidation.text('Looks good!').removeClass('error-message text-red-600').addClass('success-message text-green-600');
    $('#customer-phone').removeClass('error').addClass('valid');
    return true;
}

// Validate email input
function validateEmail(email) {
    const emailValidation = $('#customer-email-validation');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!email) {
        emailValidation.text('Email is required').removeClass('success-message text-green-600').addClass('error-message text-red-600');
        $('#customer-email').addClass('error').removeClass('valid');
        return false;
    }
    
    if (!emailRegex.test(email)) {
        emailValidation.text('Invalid email format').removeClass('success-message text-green-600').addClass('error-message text-red-600');
        $('#customer-email').addClass('error').removeClass('valid');
        return false;
    }
    
    emailValidation.text('Looks good!').removeClass('error-message text-red-600').addClass('success-message text-green-600');
    $('#customer-email').removeClass('error').addClass('valid');
    return true;
}

// Validate license input
function validateLicense(license) {
    const licenseValidation = $('#customer-license-validation');
    
    if (!license) {
        licenseValidation.text('Driver\'s license number is required').removeClass('success-message text-green-600').addClass('error-message text-red-600');
        $('#customer-license').addClass('error').removeClass('valid');
        return false;
    }
    
    if (license.length < 5) {
        licenseValidation.text('License number must be at least 5 characters long').removeClass('success-message text-green-600').addClass('error-message text-red-600');
        $('#customer-license').addClass('error').removeClass('valid');
        return false;
    }
    
    licenseValidation.text('Looks good!').removeClass('error-message text-red-600').addClass('success-message text-green-600');
    $('#customer-license').removeClass('error').addClass('valid');
    return true;
}

// Validate date input
function validateDate(date) {
    const dateValidation = $('#rental-start-date-validation');
    
    if (!date) {
        dateValidation.text('Start date is required').removeClass('success-message text-green-600').addClass('error-message text-red-600');
        $('#rental-start-date').addClass('error').removeClass('valid');
        return false;
    }
    
    // Check if date is valid
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time part for comparison
    
    if (isNaN(selectedDate.getTime())) {
        dateValidation.text('Please enter a valid date').removeClass('success-message text-green-600').addClass('error-message text-red-600');
        $('#rental-start-date').addClass('error').removeClass('valid');
        return false;
    }
    
    if (selectedDate < today) {
        dateValidation.text('Start date cannot be in the past').removeClass('success-message text-green-600').addClass('error-message text-red-600');
        $('#rental-start-date').addClass('error').removeClass('valid');
        return false;
    }
    
    dateValidation.text('Looks good!').removeClass('error-message text-red-600').addClass('success-message text-green-600');
    $('#rental-start-date').removeClass('error').addClass('valid');
    return true;
}

// Validate days input
function validateDays(days) {
    const daysValidation = $('#rental-days-validation');
    const daysNum = parseInt(days);

    if (!days || isNaN(daysNum) || daysNum < 1 || daysNum > 30) {
        daysValidation.text('Number of days must be between 1 and 30.').removeClass('success-message text-green-600').addClass('error-message text-red-600');
        $('#rental-days').addClass('error').removeClass('valid');
        return false;
    }
    
    daysValidation.text('Looks good!').removeClass('error-message text-red-600').addClass('success-message text-green-600');
    $('#rental-days').removeClass('error').addClass('valid');
    return true;
}

// Update submit button state
function updateSubmitButton() {
    const name = $('#customer-name').val();
    const phone = $('#customer-phone').val();
    const email = $('#customer-email').val();
    const license = $('#customer-license').val();
    const startDate = $('#rental-start-date').val();
    const days = $('#rental-days').val();
    
    const isValid = 
        validateName(name) &&
        validatePhone(phone) &&
        validateEmail(email) &&
        validateLicense(license) &&
        validateDate(startDate) &&
        validateDays(days);
    
    if (isValid) {
        $('#submit-reservation').prop('disabled', false).removeClass('opacity-50 cursor-not-allowed');
    } else {
        $('#submit-reservation').prop('disabled', true).addClass('opacity-50 cursor-not-allowed');
    }
}

// Save form data to localStorage
function saveFormData() {
    console.log('[Debug] saveFormData: Started.');
    console.log('[Debug] saveFormData: formWasCancelled flag from localStorage:', localStorage.getItem('formWasCancelled'));
    console.log('[Debug] loadSavedFormData: Started.');
    console.log('[Debug] loadSavedFormData: formWasCancelled flag from localStorage:', localStorage.getItem('formWasCancelled'));
    console.log('[Debug] loadSavedFormData: reservationFormData from localStorage at start:', localStorage.getItem('reservationFormData'));
    if (localStorage.getItem('formWasCancelled') === 'true') {
        console.log('[Debug] saveFormData: formWasCancelled is true. Aborting save.');
        console.log('[Debug] saveFormData: Aborting save due to form cancellation. Data will not be persisted.');
        console.log('[Debug] saveFormData: Current reservationFormData in localStorage:', localStorage.getItem('reservationFormData'));
        console.log('[Debug] saveFormData: Ending saveFormData function due to cancellation.');
        return;
    }

    // Proceed to save data if not cancelled
    const formData = {
        name: $('#customer-name').val(),
        phone: $('#customer-phone').val(),
        email: $('#customer-email').val(),
        license: $('#customer-license').val(),
        startDate: $('#rental-start-date').val(),
        days: $('#rental-days').val()
    };

    // Optional: Don't save if key fields are empty, to prevent saving blank forms unintentionally
    if (!formData.name && !formData.phone && !formData.email && !formData.startDate && !formData.days) {
        console.log('SFD: Form appears to be empty. Not saving.');
        return;
    }

    console.log('SFD: Saving form data to localStorage:', JSON.stringify(formData));
    console.log('[Debug] saveFormData: Proceeding to save. Data to save (name):', formData.name);
    localStorage.setItem('reservationFormData', JSON.stringify(formData));
    console.log('[Debug] saveFormData: reservationFormData SET in localStorage. Current value:', localStorage.getItem('reservationFormData'));
}

// Load saved form data from localStorage
function loadSavedFormData() {
    console.log('LSFD: Attempting to load form data.');
    // The decision to call this function is now primarily made by initReservationPage.
    // This function's main job is to load if data exists.
    // The 'formWasCancelled' flag should have been handled by initReservationPage.

    const savedData = localStorage.getItem('reservationFormData');
    console.log('[Debug] loadSavedFormData: Fetched reservationFormData from localStorage:', savedData);
    console.log(`LSFD: Raw reservationFormData from localStorage: ${savedData}`);

    if (savedData) {
        try {
            const formData = JSON.parse(savedData);
            if (formData && typeof formData === 'object') {
                console.log('LSFD: Valid data found, populating form fields.');
                $('#customer-name').val(formData.name || '');
            console.log('[Debug] loadSavedFormData: Loaded name from formData:', formData.name);
            console.log('[Debug] loadSavedFormData: customer-name field value AFTER setting from saved data:', $('#customer-name').val());
                $('#customer-phone').val(formData.phone || '');
                $('#customer-email').val(formData.email || '');
                $('#customer-license').val(formData.license || '');
                $('#rental-start-date').val(formData.startDate || '');
                $('#rental-days').val(formData.days || '');

                // Trigger validation for filled fields for UI consistency
                if (formData.name) validateName(formData.name);
                if (formData.phone) validatePhone(formData.phone);
                if (formData.email) validateEmail(formData.email);
                if (formData.license) validateLicense(formData.license);
                if (formData.startDate) validateDate(formData.startDate);
                if (formData.days) validateDays(formData.days);

                if (formData.days) { /* ... update price ... */ }
                updateSubmitButton();
            } else {
                console.log('LSFD: Parsed data is not a valid object, clearing corrupted data.');
                localStorage.removeItem('reservationFormData');
            }
        } catch (error) {
            console.error('LSFD: Error parsing or applying saved form data:', error);
            localStorage.removeItem('reservationFormData'); // Clear corrupted data
        }
    } else {
        console.log('LSFD: No reservationFormData found in localStorage.');
    }
}

// Reset form and clear saved data
function resetForm() {
    $('#reservation-form')[0].reset();
    localStorage.removeItem('reservationFormData');
    
    // Reset validation messages
    $('.validation-message').text('');
    $('input').removeClass('error valid');
    $('#price-calculation').addClass('hidden');
    $('#submit-button').prop('disabled', true);
}

async function submitReservation(event) {
    event.preventDefault();
    console.log('Form submission initiated...');

    // 1. Load the absolute latest car data to ensure 'allCars' and localStorage['cars'] are fresh.
    await loadCars();

    // 2. Get the currently selected car's details using the dedicated getSelectedCar() function.
    // This function handles localStorage reading, parsing, NaN checks, and finding the car in allCars.
    const carToBook = await getSelectedCar();

    if (!carToBook) {
        console.error("submitReservation: getSelectedCar() returned null. This means the selected car ID was invalid, NaN, or the car wasn't found in the latest allCars data.");
        alert('The selected car is no longer available. Please try selecting another car from the homepage.');
        // Consider re-enabling submit button or other UI cleanup if necessary
        return;
    }

    // 4. CRITICAL: Check availability AT THIS MOMENT
    if (!carToBook.availability) {
        console.warn(`Car ${carToBook.make} ${carToBook.model} (ID: ${carToBook.id}) is no longer available.`);
        const carUnavailableMessageDiv = $('#car-unavailable-message');
        carUnavailableMessageDiv.html(`<p>We're sorry, the <strong>${carToBook.make} ${carToBook.model}</strong> has just become unavailable.</p><p>Please <a href="index.html" class="font-semibold text-primary hover:underline">return to the listings</a> to select another vehicle.</p>`);
        carUnavailableMessageDiv.removeClass('hidden');
        
        $('#reservation-form-section').addClass('hidden'); // Hide the form
        localStorage.removeItem('reservationFormData'); // Clear any saved data for this attempt
        return;
    }

    // 5. Get form data
    const name = $('#customer-name').val();
    const phone = $('#customer-phone').val();
    const email = $('#customer-email').val();
    const license = $('#customer-license').val();
    const startDate = $('#rental-start-date').val();
    const days = $('#rental-days').val();

    // 6. Basic validation
    if (!name || !phone || !email || !license || !startDate || !days) {
        alert('Please fill out all required fields in the reservation form.');
        return;
    }
    if (parseInt(days) <= 0) {
        alert('Rental duration must be at least 1 day.');
        return;
    }

    // 7. Create order object
    const order = {
        orderId: 'order_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        carVin: carToBook.vin,
        car: { ...carToBook }, // Store a snapshot of car details
        customer: { name, phone, email, license },
        rentalDetails: {
            startDate,
            days: parseInt(days),
            totalPrice: parseFloat(carToBook.price_per_day) * parseInt(days)
        },
        status: 'pending',
        confirmationCode: 'CONF' + Math.floor(Math.random() * 100000)
    };

    // 8. IMPORTANT: Mark car as unavailable directly on the carToBook object and in allCars array.
    // carToBook should be a reference from allCars if getSelectedCar() worked correctly after loadCars().
    console.log(`submitReservation: Attempting to mark car ID ${carToBook.id} (${carToBook.make} ${carToBook.model}) as unavailable.`);
    console.log(`submitReservation: Car ID ${carToBook.id} current availability before change: ${carToBook.availability}`);

    // Directly update the car object obtained from getSelectedCar()
    carToBook.availability = false;
    console.log(`submitReservation: Car ID ${carToBook.id} availability after direct change to carToBook.availability: ${carToBook.availability}`);

    // Ensure this change is reflected in the global allCars array as well, though direct modification should suffice if carToBook is a reference.
    const carIndexInAllCars = allCars.findIndex(c => c.id === carToBook.id);
    if (carIndexInAllCars !== -1) {
        if (allCars[carIndexInAllCars].availability === false) {
            console.log(`submitReservation: Confirmed car ID ${carToBook.id} in allCars is now unavailable.`);
        } else {
            // This case would be unexpected if carToBook is a direct reference from allCars
            console.warn(`submitReservation: Car ID ${carToBook.id} in allCars was NOT updated to unavailable after direct carToBook update. Forcing update in allCars.`);
            allCars[carIndexInAllCars].availability = false;
        }
    } else {
        // This is a more serious consistency issue, means carToBook was not from allCars or allCars changed.
        console.error(`submitReservation: CRITICAL CONSISTENCY ERROR! Car ID ${carToBook.id} was found by getSelectedCar but now not found in allCars. This should not happen.`);
        alert("A critical data consistency error occurred while updating car availability. Please refresh and try again.");
        return; // Stop further processing
    }

    // Persist the updated allCars array (which now contains the car with availability: false)
    try {
        localStorage.setItem('cars', JSON.stringify(allCars));
        console.log(`submitReservation: Successfully updated localStorage['cars'] with new availability for car ID ${carToBook.id}.`);
    } catch (e) {
        console.error("submitReservation: Error saving updated allCars to localStorage:", e);
        alert("An error occurred while saving car availability. Your reservation may not be fully processed. Please check your orders.");
        // Decide if we should return or attempt to proceed with a 'pending' order that might have stale availability.
        return; 
    }

    // 9. Save order to localStorage
    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    orders.push(order);
    localStorage.setItem('orders', JSON.stringify(orders));
    console.log('Order saved (pending confirmation):', order.orderId);

    // 10. Display pending confirmation UI
    const confirmationHtml = `
        <div class="text-center">
            <h3 class="text-2xl font-bold text-gray-800 mb-4">Reservation Pending Confirmation</h3>
            <div class="mb-6 p-4 bg-blue-50 rounded-lg">
                <p class="mb-2">Your reservation for the <strong>${carToBook.make} ${carToBook.model}</strong> has been placed but is not yet confirmed.</p>
                <p class="font-medium mb-2">Order ID: ${order.orderId}</p>
                <p class="mb-4">Please click the button below to confirm your reservation:</p>
                <button onclick="confirmReservation('${order.orderId}')" class="inline-block bg-primary text-white font-semibold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors mb-4">Confirm Reservation</button>
                <p class="text-sm text-gray-600 italic">Note: The car will remain reserved for 30 minutes. If not confirmed within this time, the reservation may be cancelled.</p>
            </div>
        </div>
    `;
    
    $('#reservation-form')[0].reset();
    localStorage.removeItem('reservationFormData');
    
    $('#reservation-form-section').addClass('hidden');
    // $('#car-info-section').addClass('hidden'); // Decide if car info should remain visible
    
    const confirmationDiv = $('#confirmation-message');
    confirmationDiv.html(confirmationHtml).removeClass('hidden');
    $('#car-unavailable-message').addClass('hidden');
    $('#no-car-selected').addClass('hidden');
}

// Handle confirmation of a reservation
function confirmReservation(orderId) {
    console.log('Confirming reservation:', orderId);
    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    const orderIndex = orders.findIndex(o => o.orderId === orderId);
    
    if (orderIndex === -1) {
        alert('Order not found');
        return;
    }
    
    // Update order status
    orders[orderIndex].status = 'confirmed';
    localStorage.setItem('orders', JSON.stringify(orders));
    
    // Update car availability to false
    const order = orders[orderIndex];
    updateCarAvailability(order.car.id, false);
    
    // Show confirmation success message
    const confirmationDiv = document.getElementById('confirmation-message');
    confirmationDiv.innerHTML = `
        <div class="text-center">
            <h3 class="text-2xl font-bold text-green-700 mb-4">Reservation Confirmed!</h3>
            <div class="mb-6 p-6 bg-green-50 border border-green-200 rounded-lg">
                <p class="mb-3 text-lg">Your car rental has been successfully confirmed.</p>
                <p class="font-medium mb-3">Order ID: ${orderId}</p>
                <p class="mb-6 text-gray-700">Thank you for choosing SpeedyWheels!</p>
                <a href="index.html" class="inline-block bg-green-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-green-700 transition-colors">Return to Homepage</a>
            </div>
        </div>
    `;
}

// Validate form data
function validateForm(form) {
    const requiredFields = ['customer-name', 'customer-phone', 'customer-email', 'customer-license', 'rental-start-date', 'rental-days'];
    let isValid = true;

    requiredFields.forEach(field => {
        const input = form.elements[field];
        const validationDiv = document.getElementById(`${field}-validation`);
        
        if (!input.value.trim()) {
            validationDiv.textContent = 'This field is required';
            validationDiv.classList.add('error-message');
            input.classList.add('error');
            isValid = false;
        } else {
            validationDiv.textContent = '';
            validationDiv.classList.remove('error-message');
            input.classList.remove('error');
        }
    });

    return isValid;
}

function handleConfirmation(orderId, confirmationCode) {
    const result = confirmOrder(orderId, confirmationCode);
    
    if (result.success) {
        const confirmationHtml = `
            <div class="confirmation-details">
                <h3>Reservation Confirmed!</h3>
                <p>Your car rental has been successfully confirmed.</p>
                <p>Order ID: ${orderId}</p>
                <p>Thank you for choosing SpeedyWheels!</p>
                <a href="index.html" class="return-home">Return to Homepage</a>
            </div>
        `;
        document.getElementById('success-message').innerHTML = confirmationHtml;
        document.getElementById('confirmation-message').classList.remove('hidden');
    } else {
        showErrorMessage(result.message);
        document.getElementById('failure-message').classList.remove('hidden');
    }
    
    // Hide the form section in both cases
    document.getElementById('reservation-form-section').classList.add('hidden');
    document.getElementById('car-info-section').classList.add('hidden');
}

// Generate a unique order ID
function generateOrderId() {
    return 'ORD-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
}

// Save order to order.json file
function saveOrderToJson(formData, selectedCar) {
    // Generate a unique order ID
    const orderId = 'order_' + Date.now();

    // Create the order object
    const order = {
        orderId: orderId,
        car: selectedCar,
        customer: {
            name: formData.get('customer-name'),
            phone: formData.get('customer-phone'),
            email: formData.get('customer-email'),
            license: formData.get('customer-license')
        },
        rentalDetails: {
            startDate: formData.get('rental-start-date'),
            days: parseInt(formData.get('rental-days')),
            totalPrice: calculateTotalPrice(selectedCar.price_per_day, parseInt(formData.get('rental-days')))
        },
        status: 'pending',
        confirmationCode: generateConfirmationCode()
    };

    // Save to localStorage (simulating order.json)
    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    orders.push(order);
    localStorage.setItem('orders', JSON.stringify(orders));
    localStorage.setItem('latestOrderId', orderId);

    // Update car availability
    updateCarAvailability(selectedCar.id, false);

    return order;
}

// Generate a confirmation code
function generateConfirmationCode() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Confirm an order
function confirmOrder(orderId, confirmationCode) {
    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    const orderIndex = orders.findIndex(o => o.orderId === orderId);
    
    if (orderIndex === -1) {
        return { success: false, message: 'Order not found' };
    }

    const order = orders[orderIndex];
    if (order.confirmationCode !== confirmationCode) {
        return { success: false, message: 'Invalid confirmation code' };
    }

    if (order.status === 'confirmed') {
        return { success: false, message: 'Order already confirmed' };
    }

    // Update order status
    order.status = 'confirmed';
    orders[orderIndex] = order;
    localStorage.setItem('orders', JSON.stringify(orders));

    return { success: true, message: 'Order confirmed successfully' };
}

// Update car availability
function updateCarAvailability(carId, isAvailable) {
    const cars = JSON.parse(localStorage.getItem('cars') || JSON.stringify(allCars));
    const carIndex = cars.findIndex(c => c.id === carId);
    
    if (carIndex !== -1) {
        cars[carIndex].availability = isAvailable;
        localStorage.setItem('cars', JSON.stringify(cars));
        
        // Also update our in-memory cars array
        const globalCarIndex = allCars.findIndex(c => c.id === carId);
        if (globalCarIndex !== -1) {
            allCars[globalCarIndex].availability = isAvailable;
        }
    }
}

// Calculate total price
function calculateTotalPrice(dailyRate, days) {
    return parseFloat(dailyRate) * parseInt(days);
}
