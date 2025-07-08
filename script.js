const firebaseConfig = {
    apiKey: "AIzaSyAXIaZFkcVuCBPklxdhh97djZDISlKSFTI",
    authDomain: "basicsy-9205e.firebaseapp.com",
    projectId: "basicsy-9205e",
    storageBucket: "basicsy-9205e.firebasestorage.app",
    messagingSenderId: "323650253197",
    appId: "1:323650253197:web:f8a54cd83f97037e75cdc4",
    measurementId: "G-P5QEXW40EK"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const cart = [];

const path = window.location.pathname;

if (path.includes("admin.html")) {
    loadAdminOrders();
} else if (path.includes("index.html") || path === "/" || path === "/your-repo/") {
    loadProducts();
}

function loadProducts() {
    db.collection("products").get().then(snapshot => {
        const container = document.getElementById("products");
        container.innerHTML = "";

        snapshot.forEach(doc => {
            const data = doc.data();
            const div = document.createElement("div");
            div.className = "product";

            const disponibilidad = data.Disponibilidad || {};
            const colores = Object.keys(disponibilidad);

            const colorOptions = colores.map(color => {
                const qty = disponibilidad[color] || 0;
                return `<option value="${color}" ${qty === 0 ? 'disabled' : ''}>
                    ${color} (Disponible: ${qty})
                </option>`;
            }).join('');

            const buttonId = `add-${doc.id}`;

            div.innerHTML = `
              <strong>${data.Nombre}</strong><br>
              Precio: $${data.Precio}<br>
              Color:
              <select id="color-${doc.id}">
                ${colorOptions}
              </select><br>
              <button id="${buttonId}" onclick="addToCart('${doc.id}', '${data.Nombre}', ${data.Precio})">Add to Cart</button>
            `;

            container.appendChild(div);

            const totalAvailable = Object.values(disponibilidad).reduce((sum, qty) => sum + qty, 0);
            if (totalAvailable === 0) {
                document.getElementById(buttonId).disabled = true;
                document.getElementById(buttonId).innerText = "Agotado";
            }
        });
    });
}


function addToCart(id, name, price) {
    const colorSelect = document.getElementById(`color-${id}`);
    const selectedColor = colorSelect.value;
    cart.push({ id, name, price, color: selectedColor });
    renderCart();
}

function renderCart() {
    const ul = document.getElementById("cart");
    ul.innerHTML = "";
    cart.forEach(item => {
        const li = document.createElement("li");
        li.textContent = `${item.name} - $${item.price} - Color: ${item.color}`;
        ul.appendChild(li);
    });
}

async function checkout(method) {
    if (cart.length === 0) return alert("Cart is empty");

    const total = cart.reduce((sum, item) => sum + item.price, 0);

    const items = cart.map(item => ({
        productId: item.id,
        name: item.name,
        quantity: 1,
        color: item.color
    }));

    try {
        const orderRef = await db.collection("orders").add({
            items,
            total,
            method,
            confirmed: method === 'cash',
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            customerInfo: {
                name: "Test User",
                phone: "3001234567",
                direction: "test"
            }
        });

        console.log("Order placed:", orderRef.id);

        if (method === 'cash') {
            const batch = db.batch();
            for (const item of items) {
                const ref = db.collection("products").doc(item.productId);
                const snap = await ref.get();
                if (!snap.exists) {
                    console.error(`Product not found: ${item.productId}`);
                    continue;
                }

                const data = snap.data();
                if (typeof data.Cantidad !== 'number') {
                    console.error(`Invalid stock for product: ${item.productId}`);
                    continue;
                }

                const newStock = data.Cantidad - item.quantity;
                batch.update(ref, { Cantidad: newStock });
            }
            await batch.commit();
            console.log("Stock updated.");
        }

        const message = `Nueva orden (${method.toUpperCase()}):\nTotal: $${total}\n` +
            items.map(i => `${i.name} - Color: ${i.color} x${i.quantity}`).join('\n');

        const whatsapp = '573205792086';
        window.location.href = `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`;

    } catch (error) {
        console.error("Error during checkout:", error);
        alert("Error al procesar la orden. Revisa la consola.");
    }
}

// Admin Page Logic
async function loadAdminOrders() {
    const snapshot = await db.collection("orders").get();
    const tbody = document.querySelector("#orders-table tbody");
    tbody.innerHTML = "";

    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const tr = document.createElement("tr");

        const itemsHtml = data.items.map(item => {
            return `<div><strong>${item.productId}</strong> (x${item.quantity})</div>`;
        }).join("");

        tr.innerHTML = `
            <td>${docSnap.id}</td>
            <td>${data.customerInfo?.name || "-"}</td>
            <td>${data.customerInfo?.phone || "-"}</td>
            <td>${data.method}</td>
            <td>${itemsHtml}</td>
            <td>$${data.total}</td>
            <td class="${data.confirmed ? 'confirmed' : 'not-confirmed'}">${data.confirmed ? "Yes" : "No"}</td>
            <td>
                <button data-id="${docSnap.id}" data-current="${data.confirmed}">Toggle</button>
            </td>
        `;

        tbody.appendChild(tr);
    });

    attachToggleListeners();
}

function attachToggleListeners() {
    document.querySelectorAll("button[data-id]").forEach(button => {
        button.addEventListener("click", async () => {
            const id = button.dataset.id;
            const current = button.dataset.current === "true";
            await db.collection("orders").doc(id).update({ confirmed: !current });
            loadAdminOrders();
        });
    });
}