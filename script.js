document.addEventListener('DOMContentLoaded', function() {
    fetch('data.csv')
        .then(response => response.text())
        .then(data => {
            const rows = data.split('\n').slice(1).filter(row => row.trim() !== '');
            const menData = [];
            const womenData = [];

            rows.forEach(row => {
                const [category, name, ...eventData] = row.split(',').map(item => item.trim());
                const events = [];
                for (let i = 0; i < eventData.length; i += 2) {
                    events.push({ score: parseInt(eventData[i], 10), string: eventData[i + 1] });
                }
                const score = events.reduce((sum, event) => sum + event.score, 0);
                const participant = { name, score, events };
                if (category === 'men') {
                    menData.push(participant);
                } else if (category === 'women') {
                    womenData.push(participant);
                }
            });

            if (menData.length > 0) {
                const menEventRanks = calculateEventRanks(menData);
                renderTable(menData, menEventRanks, 'men');
            }
            
            if (womenData.length > 0) {
                const womenEventRanks = calculateEventRanks(womenData);
                renderTable(womenData, womenEventRanks, 'women');
            }
        })
        .catch(error => {
            console.error('Error fetching CSV data:', error);
        });

    fetch('workouts.csv')
        .then(response => response.text())
        .then(data => {
            const rows = data.split('\n').slice(1).filter(row => row.trim() !== '');
            const workouts = {};

            rows.forEach(row => {
                const [workout, ...descriptionParts] = row.split(',');
                const description = descriptionParts.join(',').trim().replace(/\\n/g, '<br>');
                workouts[workout.trim()] = description;
            });

            window.workouts = workouts;
        })
        .catch(error => {
            console.error('Error fetching workouts CSV data:', error);
        });

    function calculateEventRanks(data) {
        const eventCount = data[0].events.length;
        const eventRanks = Array.from({ length: eventCount }, () => []);
        data.forEach(participant => {
            participant.events.forEach((event, index) => {
                eventRanks[index].push({ name: participant.name, score: event.score });
            });
        });
        eventRanks.forEach(ranks => ranks.sort((a, b) => b.score - a.score));
        return eventRanks.map(ranks => ranks.reduce((map, { name }, rank) => (map[name] = rank + 1, map), {}));
    }

    function renderTable(data, eventRanks, tableId) {
        data.sort((a, b) => b.score - a.score);
        const tbody = document.querySelector(`#${tableId} tbody`);
        tbody.innerHTML = '';
        data.forEach((participant, rank) => {
            const eventCells = participant.events.map((event, index) => `
                <td>
                    <div class="event-details">${event.score}</div>
                    <div class="event-extra">
                        <span>${eventRanks[index][participant.name]}</span>
                        <span>(${event.string})</span>
                    </div>
                </td>
            `).join('');
            const row = `<tr>
                <td>${participant.name}</td>
                <td>${rank + 1}</td>
                <td>${participant.score}</td>
                ${eventCells}
            </tr>`;
            tbody.innerHTML += row;
        });
    }

    window.showTab = function(tabId) {
        const tabs = document.querySelectorAll('.tab');
        const tabContents = document.querySelectorAll('.tab-content, .table-container');
        tabs.forEach(tab => tab.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        document.querySelector(`.tab[onclick="showTab('${tabId}')"]`).classList.add('active');
        document.getElementById(`${tabId}-content`)?.classList.add('active');
        document.getElementById(`${tabId}-container`)?.classList.add('active');
        if (tabId === 'workouts') {
            document.getElementById('workout-subtabs').classList.add('active');
        } else {
            document.getElementById('workout-subtabs').classList.remove('active');
        }
    }

    window.showWorkout = function(workoutNumber) {
        const workoutDetails = document.getElementById('workout-details');
        workoutDetails.innerHTML = window.workouts[workoutNumber] || 'Workout details not found.';

        // Update the active subtab
        const subtabs = document.querySelectorAll('.subtab');
        subtabs.forEach(subtab => subtab.classList.remove('active'));
        document.querySelector(`.subtab[onclick="showWorkout(${workoutNumber})"]`).classList.add('active');
    }

    window.sortTable = function(tableId, columnIndex, order) {
        const table = document.getElementById(tableId);
        const tbody = table.querySelector('tbody');
        const rows = Array.from(tbody.rows);

        rows.sort((a, b) => {
            const cellA = a.cells[columnIndex].textContent.trim();
            const cellB = b.cells[columnIndex].textContent.trim();

            if (columnIndex > 0) {
                const numA = parseFloat(cellA);
                const numB = parseFloat(cellB);
                return order === 'asc' ? numA - numB : numB - numA;
            } else {
                return order === 'asc' ? cellA.localeCompare(cellB) : cellB.localeCompare(cellA);
            }
        });

        rows.forEach(row => tbody.appendChild(row));

        const ths = table.querySelectorAll('th');
        ths.forEach(th => th.classList.remove('sorted-asc', 'sorted-desc'));
        const th = ths[columnIndex];
        th.classList.add(order === 'asc' ? 'sorted-asc' : 'sorted-desc');
    }
});
