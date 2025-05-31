# 32516 Assignment 2 - Car Rental Website by Tanut Pue-on 25677093

A fully functional car rental website with rich interactive features enabled by AJAX. This website allows users to browse, search, filter, and rent cars online.

## Features

### Homepage
- Grid layout of available cars
- Company logo and navigation
- Reservation icon to quickly access the reservation page

### Search Functionality
- Keyword-based search for car type, brand, model, and description
- Real-time search suggestions as you type
- Search results displayed in a grid layout

### Filtering Options
- Filter cars by type (Sedan, SUV, etc.)
- Filter cars by brand (Toyota, Honda, etc.)
- Combine search and filters for precise results

### Car Display
- Each car shows its model, make, type, year, price, and availability
- Unavailable cars have disabled rent buttons
- Available cars can be selected for rental

### Reservation System
- Detailed car information on the reservation page
- Form for customer details with real-time validation
- Price calculation based on rental period
- Form data persistence for unfinished reservations

### Order Processing
- Confirmation of successful orders
- Availability updates for rented cars
- Error handling for unavailable cars

## Technology Stack

- HTML5, CSS3, JavaScript
- jQuery and jQuery UI for enhanced interactivity
- AJAX for asynchronous data loading and form submission
- Font Awesome for icons
- Local Storage for data persistence

## Getting Started

1. Clone the repository
2. Open `index.html` in your browser to view the car listing page
3. Click on a car's 'Rent Now' button to navigate to the reservation page
4. Fill out the form with valid information to complete a rental

## Project Structure

- `index.html` - Homepage with car listings
- `reservation.html` - Car reservation page
- `css/style.css` - Styling for all pages
- `js/script.js` - JavaScript functionality
- `data/cars.json` - Car inventory data
- `images/` - Car images and logo
