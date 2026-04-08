document.addEventListener("DOMContentLoaded", () => {
    const catalogue = {
        panneaux: [
            { label: "Jinko Tiger 400W",     puissanceCrete: 400, U: 31, Icc: 13.7 },
            { label: "Canadian Solar 550W",  puissanceCrete: 550, U: 41, Icc: 14.0 },
            { label: "Generic 150W",          puissanceCrete: 150, U: 18, Icc: 8.8  }
        ],
        batteries: [
            { label: "Gel 200Ah 12V",        capacite: 200, U: 12, type: "plomb"   },
            { label: "Lithium 100Ah 12V",    capacite: 100, U: 12, type: "lithium" },
            { label: "Pylontech 74Ah 48V",   capacite: 74,  U: 48, type: "lithium" }
        ]
    };

    // ── Carte Leaflet ─────────────────────────────────────────────────────────
    const map = L.map('map').setView([-4.322, 15.312], 7);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(map);

    let marker = null;

    map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        if (marker) map.removeLayer(marker);
        marker = L.marker([lat, lng]).addTo(map);
        document.getElementById('latInput').value = lat.toFixed(6);
        document.getElementById('longInput').value = lng.toFixed(6);
        // Retirer l'état d'erreur si présent
        document.getElementById('latInput').style.borderColor = '';
        document.getElementById('longInput').style.borderColor = '';
    });

    // ── Équipements ───────────────────────────────────────────────────────────
    // On utilise un compteur monotone pour les indices, et on renumérote
    // les labels visuels à chaque ajout/suppression.
    // L'index du name= est le rang courant dans le DOM, pas un compteur global,
    // ce qui garantit des indices contigus à la soumission.

    const container = document.getElementById('equipementsContainer');

    function renumeroterEquipements() {
        const entries = container.querySelectorAll('.equipement-entry');
        entries.forEach((entry, i) => {
            // Label visuel
            const label = entry.querySelector('.eq-label');
            if (label) label.textContent = `Appareil #${i + 1}`;

            // Noms des inputs
            entry.querySelectorAll('input').forEach((input) => {
                // name="equipements[OLD][champ]" → name="equipements[i][champ]"
                input.name = input.name.replace(/equipements\[\d+\]/, `equipements[${i}]`);
            });
        });
    }

    function addEquipement() {
        const i = container.querySelectorAll('.equipement-entry').length;
        const div = document.createElement('div');
        div.className = 'equipement-entry';
        div.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <strong class="eq-label">Appareil #${i + 1}</strong>
                <button type="button" class="remove-btn" aria-label="Supprimer">✕</button>
            </div>
            <div class="grid-3" style="margin-top:10px;">
                <div>
                    <label>Nom</label>
                    <input type="text" name="equipements[${i}][nom]" placeholder="Ex : Frigo" style="width:100%;">
                </div>
                <div>
                    <label>Puissance (W)</label>
                    <input type="number" name="equipements[${i}][puissance]" placeholder="150" min="1" required style="width:100%;">
                </div>
                <div>
                    <label>Durée/jour (h)</label>
                    <input type="number" name="equipements[${i}][tempsJournalier]" placeholder="8" min="0.1" max="24" step="0.1" required style="width:100%;">
                </div>
            </div>
        `;
        div.querySelector('.remove-btn').addEventListener('click', () => {
            // Interdire la suppression du dernier équipement
            if (container.querySelectorAll('.equipement-entry').length <= 1) return;
            div.remove();
            renumeroterEquipements();
        });
        container.appendChild(div);
    }

    document.getElementById('addEquipementButton').addEventListener('click', addEquipement);
    addEquipement(); // Premier équipement par défaut

    // ── Selects catalogue ─────────────────────────────────────────────────────
    function setupSelect(id, data, infoId) {
        const select = document.getElementById(id);
        if (!select) return;
        data.forEach(item => {
            const opt = document.createElement('option');
            opt.value = JSON.stringify(item);
            opt.textContent = item.label;
            select.appendChild(opt);
        });
        const info = document.getElementById(infoId);
        function updateInfo() {
            try {
                const val = JSON.parse(select.value);
                const spec = val.puissanceCrete
                    ? `${val.puissanceCrete} Wc — ${val.U} V — Icc ${val.Icc} A`
                    : `${val.capacite} Ah — ${val.U} V — ${val.type}`;
                info.textContent = spec;
            } catch (_) {
                info.textContent = '';
            }
        }
        select.addEventListener('change', updateInfo);
        updateInfo();
    }

    setupSelect('selectPanneau',  catalogue.panneaux,  'infoPanneau');
    setupSelect('selectBatterie', catalogue.batteries, 'infoBatterie');

    // ── Validation avant soumission ───────────────────────────────────────────
    document.getElementById('datasForm').addEventListener('submit', (e) => {
        const lat  = document.getElementById('latInput').value;
        const long = document.getElementById('longInput').value;

        if (!lat || !long) {
            e.preventDefault();
            document.getElementById('latInput').style.borderColor  = '#e74c3c';
            document.getElementById('longInput').style.borderColor = '#e74c3c';
            // Message d'erreur sous la carte
            let msg = document.getElementById('map-error');
            if (!msg) {
                msg = document.createElement('p');
                msg.id = 'map-error';
                msg.style.cssText = 'color:#e74c3c;margin-top:8px;font-size:0.9rem;';
                document.getElementById('map').insertAdjacentElement('afterend', msg);
            }
            msg.textContent = '⚠ Veuillez cliquer sur la carte pour sélectionner une localisation.';
            return;
        }

        // Vérifier qu'au moins un équipement a une puissance > 0
        const puissances = document.querySelectorAll('[name$="[puissance]"]');
        const total = Array.from(puissances).reduce((s, el) => s + (parseFloat(el.value) || 0), 0);
        if (total <= 0) {
            e.preventDefault();
            alert('Veuillez saisir au moins un équipement avec une puissance non nulle.');
        }
    });
});
