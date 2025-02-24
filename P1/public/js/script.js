document.addEventListener("DOMContentLoaded", () => {
    // Redirigir en Inicio y logo
    document.querySelector(".logo").addEventListener("click", () => window.location.href = "index.html");
    document.querySelector(".acciones a[href='#']").addEventListener("click", () => window.location.href = "index.html");
    
    // Buscador de productos
    const searchInput = document.querySelector(".buscador input");
    const searchButton = document.querySelector(".buscador button");
    const productos = document.querySelectorAll(".producto");
    const products = [
        'Funko Pop! Harry Potter And Buckbeak', 
        'Figura Acción Sora',
        'Taza de Star Wars',
        'Figura Acción Erza Scarlet',
        'Taza de Genshin Impact',
        'Funko Pop! Captain Jack Sparrow Sparrow',
        'Figura Acción Shen-Long',
        'Funko Pop! Satoru Gojo',
        'Taza de Super Mario'
    ];

    const realizarBusqueda = () => {
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
            window.location.href = "producto_no_encontrado.html";
        }
    };

    searchButton.addEventListener("click", realizarBusqueda);
    searchInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            realizarBusqueda();
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
