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

  function loadProducts() {
    db.collection("products").get().then(snapshot => {
      const container = document.getElementById("products");
      snapshot.forEach(doc => {
        const data = doc.data();
        const div = document.createElement("div");
        div.className = "product";
        div.innerHTML = `<strong>${data.Nombre} (${data.Color})</strong><br>
                         Precio: $${data.Precio}<br>
                         Cantidad: ${data.Cantidad}<br>
                         <button onclick="addToCart('${doc.id}', '${data.Nombre}', ${data.Precio})">Add to Cart</button>`;
        container.appendChild(div);
      });
    });
  }

  function addToCart(id, name, price) {
    cart.push({ id, name, price });
    renderCart();
  }

  function renderCart() {
    const ul = document.getElementById("cart");
    ul.innerHTML = "";
    cart.forEach(item => {
      const li = document.createElement("li");
      li.textContent = `${item.name} - $${item.price}`;
      ul.appendChild(li);
    });
  }

  async function checkout(method) {
    if (cart.length === 0) return alert("Cart is empty");
    const grouped = {};
    cart.forEach(item => {
      grouped[item.id] = grouped[item.id] ? grouped[item.id] + 1 : 1;
    });

    const items = Object.keys(grouped).map(id => ({ productId: id, quantity: grouped[id] }));
    const total = cart.reduce((sum, item) => sum + item.price, 0);

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

    if (method === 'cash') {
      // decrease stock now
      const batch = db.batch();
      for (const item of items) {
        const ref = db.collection("products").doc(item.productId);
        const snap = await ref.get();
        const newStock = snap.data().stock - item.quantity;
        batch.update(ref, { stock: newStock });
      }
      await batch.commit();
    }

    const message = `Nueva orden (${method.toUpperCase()}):\nTotal: $${total}\nItems: ${items.map(i => i.productId + ' x' + i.quantity).join(', ')}`;
    const whatsapp = '573205792086';
    window.location.href = `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`;
  }

  loadProducts();