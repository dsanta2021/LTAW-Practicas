document.addEventListener("DOMContentLoaded", () => {
    // Redirigir en Inicio y logo
    document.querySelector(".logo").addEventListener("click", () => window.location.href = "index.html");
    document.querySelector(".acciones a[href='#']").addEventListener("click", () => window.location.href = "index.html");
    
    // Buscador de productos
    const searchInput = document.querySelector(".buscador input");
    const searchButton = document.querySelector(".buscador button");

    const realizarBusqueda = () => {
        const searchTerm = searchInput.value.trim().toLowerCase();
        if (searchTerm) {
            window.location.href = `index.html?search=${encodeURIComponent(searchTerm)}`;
        }
    };

    searchButton.addEventListener("click", realizarBusqueda);
    searchInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            realizarBusqueda();
        }
    });

    // Filtrar productos si hay un término de búsqueda en la URL
    const params = new URLSearchParams(window.location.search);
    const searchTerm = params.get("search");

    if (searchTerm) {
        const productos = document.querySelectorAll(".producto");
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
    }
    
});
