document.addEventListener("DOMContentLoaded", () => {
    // Redirigir al inicio al hacer clic en el logo
    document.querySelector(".logo").addEventListener("click", () => window.location.href = "/");

    // Elementos del buscador
    const searchInput = document.querySelector(".buscador input");
    const searchButton = document.querySelector(".buscador button");
    const sugerencias = document.getElementById("sugerencias");

    const buscarProductos = async (termino) => {
        sugerencias.innerHTML = ""; // Limpiar sugerencias previas
    
        if (termino.length < 3) {
            sugerencias.style.display = "none"; // Ocultar si el término es menor a 3 caracteres
            return;
        }
    
        try {
            const response = await fetch(`/buscar-autocompletado?termino=${encodeURIComponent(termino)}`);
            if (response.ok) {
                const productos = await response.json();
                if (productos.length > 0) {
                    productos.forEach(producto => {
                        const div = document.createElement("div");
                        div.textContent = producto.nombre;
                        div.onclick = () => window.location.href = `/producto/${producto.id}`;
                        sugerencias.appendChild(div);
                    });
                    sugerencias.style.display = "block"; // Mostrar sugerencias
                } else {
                    sugerencias.style.display = "none"; // Ocultar si no hay resultados
                }
            } else {
                console.error("Error al buscar productos");
            }
        } catch (error) {
            console.error("Error:", error);
        }
    };

    // Ocultar sugerencias al hacer clic fuera del buscador
    document.addEventListener("click", (event) => {
        if (!event.target.closest(".buscador")) {
            sugerencias.style.display = "none";
        }
    });

    // Función para realizar la búsqueda al presionar el botón o "Enter"
    const realizarBusqueda = () => {
        const termino = searchInput.value.trim();
        if (termino.length >= 3) {
            window.location.href = `/buscar?termino=${encodeURIComponent(termino)}`;
        }
    };

    // Eventos del buscador
    searchInput.addEventListener("input", (event) => buscarProductos(event.target.value));
    searchButton.addEventListener("click", realizarBusqueda);
    searchInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            realizarBusqueda();
        }
    });
});