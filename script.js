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

async function addToCart(id, name, price) {
    const colorSelect = document.getElementById(`color-${id}`);
    const selectedColor = colorSelect.value;

    if (!selectedColor) {
        return alert("Please select a color.");
    }

    try {
        const doc = await db.collection("products").doc(id).get();
        if (!doc.exists) {
            return alert("Product not found.");
        }

        const data = doc.data();
        const disponibilidad = data.Disponibilidad || {};
        const stock = disponibilidad[selectedColor];

        if (typeof stock !== "number" || stock <= 0) {
            return alert(`No stock available for ${selectedColor}`);
        }

        const existingItem = cart.find(item => item.id === id && item.color === selectedColor);
        const currentInCart = existingItem ? existingItem.quantity : 0;

        if (currentInCart >= stock) {
            return alert(`Solo puedes agregar hasta ${stock} de ${name} (${selectedColor})`);
        }

        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cart.push({ id, name, price, color: selectedColor, quantity: 1 });
        }

        renderCart();
    } catch (error) {
        console.error("Error checking stock:", error);
        alert("There was a problem adding the item to the cart.");
    }
}



function renderCart() {
    const ul = document.getElementById("cart");
    ul.innerHTML = "";
    cart.forEach(item => {
        const li = document.createElement("li");
        li.textContent = `${item.name} - $${item.price} - Color: ${item.color} x${item.quantity}`;
        ul.appendChild(li);
    });
}

async function checkout(method) {
    if (cart.length === 0) return alert("Cart is empty");

    const total = cart.reduce((sum, item) => sum + item.price, 0);

    const items = cart.map(item => ({
        productId: item.id,
        name: item.name,
        quantity: item.quantity,
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

            // Group cart items by productId
            const grouped = {};

            for (const item of items) {
                if (!grouped[item.productId]) {
                    grouped[item.productId] = {};
                }

                if (!grouped[item.productId][item.color]) {
                    grouped[item.productId][item.color] = 0;
                }

                grouped[item.productId][item.color] += item.quantity;
            }

            for (const productId in grouped) {
                const ref = db.collection("products").doc(productId);
                const snap = await ref.get();
                if (!snap.exists) {
                    console.error(`Product not found: ${productId}`);
                    continue;
                }

                const data = snap.data();
                if (!data.Disponibilidad) {
                    console.error(`No Disponibilidad in product ${productId}`);
                    continue;
                }

                const disponibilidad = { ...data.Disponibilidad };
                const colorUpdates = grouped[productId];

                let valid = true;

                for (const color in colorUpdates) {
                    if (typeof disponibilidad[color] !== 'number') {
                        console.error(`Missing stock for ${color} in ${productId}`);
                        valid = false;
                        break;
                    }

                    const newStock = disponibilidad[color] - colorUpdates[color];
                    if (newStock < 0) {
                        console.warn(`Not enough stock for ${productId} - ${color}`);
                        valid = false;
                        break;
                    }

                    disponibilidad[color] = newStock;
                }

                if (!valid) continue;

                batch.update(ref, { Disponibilidad: disponibilidad });
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
            return `
                <div>
                    <strong>${item.name}</strong> 
                    - Color: ${item.color || "-"} 
                    - x${item.quantity}
                </div>`;
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
            const newConfirmed = !current;

            const orderRef = db.collection("orders").doc(id);
            const orderSnap = await orderRef.get();
            if (!orderSnap.exists) {
                console.error("Order not found:", id);
                return;
            }

            const order = orderSnap.data();

            if (order.method === 'cash' && current === true && newConfirmed === false) {
                // We are toggling OFF a confirmed cash order — we should revert the stock
                const batch = db.batch();

                const productChanges = {};

                // Group changes by product ID
                for (const item of order.items) {
                    if (!productChanges[item.productId]) {
                        productChanges[item.productId] = {};
                    }
                    if (!productChanges[item.productId][item.color]) {
                        productChanges[item.productId][item.color] = 0;
                    }
                    productChanges[item.productId][item.color] += item.quantity;
                }

                // Now apply all stock changes per product
                for (const [productId, colorChanges] of Object.entries(productChanges)) {
                    const productRef = db.collection("products").doc(productId);
                    const productSnap = await productRef.get();

                    if (!productSnap.exists) {
                        console.error("Product not found:", productId);
                        continue;
                    }

                    const productData = productSnap.data();
                    const disponibilidad = { ...productData.Disponibilidad };

                    for (const [color, qty] of Object.entries(colorChanges)) {
                        if (typeof disponibilidad[color] !== "number") {
                            console.error(`Missing color ${color} in product ${productId}`);
                            continue;
                        }
                        disponibilidad[color] += qty; // Revert stock
                    }

                    batch.update(productRef, { Disponibilidad: disponibilidad });
                }

                await batch.commit();
                console.log("Stock reverted.");
            }

            // Now update the confirmed field
            await orderRef.update({ confirmed: newConfirmed });

            loadAdminOrders(); // Reload UI
        });
    });
}
