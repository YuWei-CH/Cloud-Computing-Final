// Common script to apply global settings across all pages
document.addEventListener('DOMContentLoaded', function () {
    // Apply dark mode setting
    const darkMode = localStorage.getItem('darkMode');
    if (darkMode === 'enabled') {
        document.getElementById('dark-theme').disabled = false;
        document.body.classList.add('dark-mode');
    }

    // Apply font size setting
    const fontSize = localStorage.getItem('fontSize');
    if (fontSize) {
        document.body.classList.remove('font-size-small', 'font-size-medium', 'font-size-large');
        document.body.classList.add(`font-size-${fontSize}`);
    }
});
