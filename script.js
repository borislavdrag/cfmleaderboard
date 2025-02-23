document.addEventListener('DOMContentLoaded', function() {
    Promise.all([
        fetch('data.csv').then(response => response.text()),
        fetch('workouts.csv').then(response => response.text())
    ])
    .then(([leaderboardData, workoutData]) => {
        processLeaderboardData(parseCSV(leaderboardData));
        processWorkoutData(parseCSV(workoutData));
        
        showWorkout(1);
        showTab('men');
    })
    .catch(error => {
        console.error('Error loading data:', error);
        document.body.innerHTML += `<div style="color: red">Error loading data: ${error.message}</div>`;
    });
});

function parseCSV(csvText) {
    return csvText
        .split('\n')
        .slice(1)
        .filter(row => row.trim() !== '')
        .map(row => row.split(',').map(cell => cell.trim()));
}

function processLeaderboardData(rows) {
    const menData = [];
    const womenData = [];

    rows.forEach(row => {
        if (row.length < 3) return;
        
        const category = row[0].toLowerCase();
        const name = row[1];
        const eventData = row.slice(2);
        
        const events = [];
        for (let i = 0; i < eventData.length; i += 2) {
            const score = parseInt(eventData[i]) || 0;
            const string = eventData[i + 1] || '';
            events.push({ score, string });
        }
        
        const totalScore = events.reduce((sum, event) => sum + event.score, 0);
        const participant = { name, score: totalScore, events };

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
}

function processWorkoutData(rows) {
    const workouts = {};
    rows.forEach(row => {
        if (row.length < 2) return;
        
        const workoutNumber = row[0].trim();
        const description = row.slice(1).join(',').trim()
            .replace(/\\n/g, '<br>')
            .replace(/\n/g, '<br>');
        
        workouts[workoutNumber] = description;
    });
    window.workouts = workouts;
}

function calculateEventRanks(data) {
    const eventCount = data[0].events.length;
    const eventRanks = Array.from({ length: eventCount }, () => []);
    data.forEach(participant => {
        participant.events.forEach((event, index) => {
            eventRanks[index].push({ name: participant.name, score: event.score });
        });
    });
    eventRanks.forEach(ranks => ranks.sort((a, b) => b.score - a.score));

    return eventRanks.map(ranks => {
        const rankMap = {};
        let currentRank = 1;
        ranks.forEach((rank, index) => {
            if (index > 0 && ranks[index].score < ranks[index - 1].score) {
                currentRank = index + 1;
            }
            rankMap[rank.name] = currentRank;
        });
        return rankMap;
    });
}

function renderTable(data, eventRanks, tableId) {
    data.sort((a, b) => {
        if (b.score === a.score) {
            const ranksA = a.events.map((event, i) => eventRanks[i][a.name]).sort((x, y) => x - y);
            const ranksB = b.events.map((event, i) => eventRanks[i][b.name]).sort((x, y) => x - y);
            for (let i = 0; i < ranksA.length; i++) {
                if (ranksA[i] !== ranksB[i]) {
                    return ranksA[i] - ranksB[i];
                }
            }
            return 0;
        }
        return b.score - a.score;
    });

    const tbody = document.querySelector(`#${tableId} tbody`);
    tbody.innerHTML = '';
    let previousRank = 1;
    let currentRank = 1;
    
    data.forEach((participant, index) => {
        const eventCells = participant.events.map((event, i) => `
            <td>
                <div class="event-details">${event.score}</div>
                ${event.string ? `<div class="event-extra"><span>${eventRanks[i][participant.name]}</span> (${event.string})</div>` : `<div class="event-extra"><span>${eventRanks[i][participant.name]}</span></div>`}
            </td>
        `).join('');
        
        if (index > 0 && data[index - 1].score === participant.score) {
            const ranksA = participant.events.map((event, i) => eventRanks[i][participant.name]).sort((x, y) => x - y);
            const ranksB = data[index - 1].events.map((event, i) => eventRanks[i][data[index - 1].name]).sort((x, y) => x - y);
            let isTied = true;
            for (let i = 0; i < ranksA.length; i++) {
                if (ranksA[i] !== ranksB[i]) {
                    isTied = false;
                    break;
                }
            }
            if (isTied) {
                currentRank = previousRank;
            } else {
                currentRank = index + 1;
            }
        } else {
            currentRank = index + 1;
        }
        previousRank = currentRank;

        const row = `<tr>
            <td>${participant.name}</td>
            <td>${currentRank}</td>
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
};

window.showWorkout = function(workoutNumber) {
    const workoutDetails = document.getElementById('workout-details');
    workoutDetails.innerHTML = window.workouts[workoutNumber] || 'Workout details not found.';

    const subtabs = document.querySelectorAll('#workout-subtabs .subtab');
    subtabs.forEach(subtab => subtab.classList.remove('active'));
    document.querySelector(`#workout-subtabs .subtab[onclick="showWorkout(${workoutNumber})"]`).classList.add('active');
};

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
};
