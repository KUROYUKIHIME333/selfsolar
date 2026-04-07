document.addEventListener("DOMContentLoaded", () => {
    // Les données du catalogue pourraient venir d'une API, ici on garde votre logique
    const catalogue = {
        panneaux: [
            { label: "Jinko Tiger 400W", puissanceCrete: 400, U: 31, Icc: 13.7 },
            { label: "Canadian Solar 550W", puissanceCrete: 550, U: 41, Icc: 14.0 },
            { label: "Generic 150W", puissanceCrete: 150, U: 18, Icc: 8.8 }
        ],
        batteries: [
            { label: "Gel 200Ah 12V", capacite: 200, U: 12, type: "plomb" },
            { label: "Lithium 100Ah 12V", capacite: 100, U: 12, type: "lithium" },
            { label: "Pylontech 74Ah 48V", capacite: 74, U: 48, type: "lithium" }
        ]
    };

    // Gestion de la Map
    const map = L.map('map').setView([-4.322, 15.312], 12);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map); // Style sombre pour la carte

    let marker;
    map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        if (marker) map.removeLayer(marker);
        marker = L.marker([lat, lng]).addTo(map);
        document.getElementById('latInput').value = lat.toFixed(6);
        document.getElementById('longInput').value = lng.toFixed(6);
    });

    // Gestion dynamique des équipements
    let eqCount = 0;
    const addEq = () => {
        const container = document.getElementById('equipementsContainer');
        const div = document.createElement('div');
        div.className = 'equipement-entry';
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <strong>Appareil #${eqCount + 1}</strong>
                <button type="button" class="remove-btn" onclick="this.parentElement.parentElement.remove()">✕</button>
            </div>
            <div class="grid-3" style="margin-top:10px;">
                <input type="text" name="equipements[${eqCount}][nom]" placeholder="Nom (ex: Frigo)" required>
                <input type="number" name="equipements[${eqCount}][puissance]" placeholder="Watts" required>
                <input type="number" name="equipements[${eqCount}][tempsJournalier]" step="0.1" placeholder="Heures/j" required>
            </div>
        `;
        container.appendChild(div);
        eqCount++;
    };

    document.getElementById('addEquipementButton').addEventListener('click', addEq);
    addEq(); // Premier équipement par défaut

    // Setup des listes de matériel
    const setupSelect = (id, data, infoId) => {
        const select = document.getElementById(id);
        if(!select) return;
        data.forEach(item => {
            const opt = document.createElement('option');
            opt.value = JSON.stringify(item);
            opt.textContent = item.label;
            select.appendChild(opt);
        });
        select.onchange = () => {
            const val = JSON.parse(select.value);
            document.getElementById(infoId).innerText = `Spécifications : ${val.puissanceCrete || val.capacite}${val.puissanceCrete ? 'Wc' : 'Ah'} - ${val.U}V`;
        };
        select.dispatchEvent(new Event('change'));
    };

    setupSelect('selectPanneau', catalogue.panneaux, 'infoPanneau');
    setupSelect('selectBatterie', catalogue.batteries, 'infoBatterie');
});