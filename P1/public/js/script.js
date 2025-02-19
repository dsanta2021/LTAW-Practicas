document.addEventListener("DOMContentLoaded", () => {
    // Redirigir en Inicio y logo
    document.querySelector(".logo").addEventListener("click", () => window.location.href = "index.html");
    document.querySelector(".acciones a[href='#']").addEventListener("click", () => window.location.href = "index.html");
    
    // Buscador de productos
    const searchInput = document.querySelector(".buscador input");
    const searchButton = document.querySelector(".buscador button");
    const productos = document.querySelectorAll(".producto");

    searchButton.addEventListener("click", () => {
        const searchTerm = searchInput.value.toLowerCase();
        let found = false;
        
        productos.forEach(producto => {
            const nombre = producto.querySelector("h2").textContent.toLowerCase();
            if (nombre.includes(searchTerm)) {
                producto.style.display = "block";
                found = true;
            } else {
                producto.style.display = "none";
            }
        });
        
        if (!found) {
            alert("Producto no disponible");
        }
    });

    // Selector de idioma
    const languageSelector = document.querySelector("select");
    
    languageSelector.addEventListener("change", (event) => {
        if (event.target.value === "🇬🇧 EN") {
            window.location.href = "index_en.html";
        } else {
            window.location.href = "index.html";
        }
    });
    
});
