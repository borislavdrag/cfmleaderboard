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
                    const score = eventData[i] ? parseInt(eventData[i], 10) : 0; // Ensure missing scores are treated as 0
                    events.push({ score: isNaN(score) ? 0 : score, string: eventData[i + 1] || '' });
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
            const description = descriptionParts.join(',').trim().replace(/\\n/g, '<br>').replace(/\n/g, '<br>');
            workouts[workout.trim()] = description;
        });

        window.workouts = workouts;
    })
    .catch(error => {
        console.error('Error fetching workouts CSV data:', error);
    });

    fetch('heats.csv')
    .then(response => response.text())
    .then(data => {
        const rows = data.split('\n').slice(1).filter(row => row.trim() !== '');
        const heats = {};

        rows.forEach(row => {
            const [heat, ...descriptionParts] = row.split(',');
            const description = descriptionParts.join(',').trim();
            heats[`Heat ${heat.trim()}`] = description;
        });

        window.heats = heats;

        // Debug: Log the parsed heats data to ensure it's correct
        console.log('Heats Data:', window.heats);
    })
    .catch(error => {
        console.error('Error fetching heats CSV data:', error);
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
    // Sort data by overall score, and then by the highest event ranks
    data.sort((a, b) => {
        if (b.score === a.score) {
            const ranksA = a.events.map((event, i) => eventRanks[i][a.name]).sort((x, y) => x - y);
            const ranksB = b.events.map((event, i) => eventRanks[i][b.name]).sort((x, y) => x - y);
            for (let i = 0; i < ranksA.length; i++) {
                if (ranksA[i] !== ranksB[i]) {
                    return ranksA[i] - ranksB[i];
                }
            }
            return 0; // They are completely tied
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
            // Compare highest ranks to determine if they are tied
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
                currentRank = previousRank; // They are tied
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
    if (tabId === 'heats') {
            document.getElementById('heats-subtabs').classList.add('active');
            document.getElementById('heat-table').style.display = 'none'; // Hide the table initially
        } else {
            document.getElementById('heats-subtabs').classList.remove('active');
        }
    }
    window.showWorkout = function(workoutNumber) {
    	const workoutDetails = document.getElementById('workout-details');
    	workoutDetails.innerHTML = window.workouts[workoutNumber] || 'Workout details not found.';

    	// Update the active subtab
    	const subtabs = document.querySelectorAll('#workout-subtabs .subtab');
    	subtabs.forEach(subtab => subtab.classList.remove('active'));
    	document.querySelector(`#workout-subtabs .subtab[onclick="showWorkout(${workoutNumber})"]`).classList.add('active');
    }

   window.showHeat = function(heatNumber) {
    const heatDetails = document.getElementById('heat-details');
    const heatTable = document.getElementById('heat-table');
    const heatTableBody = document.querySelector('#heat-table tbody');
    heatTableBody.innerHTML = ''; // Clear previous heat details
    heatTable.style.display = 'table'; // Show the table

    const heatKey = `Heat ${heatNumber}`;
    let heatDescription = window.heats[heatKey] || 'Heat details not found.';

    // Remove quotation marks
    heatDescription = heatDescription.replace(/(^"|"$)/g, '');

    if (heatDescription !== 'Heat details not found.') {
        const lines = heatDescription.split('\\n').map(line => line.trim()).filter(line => line);
        const headers = lines[0].split(',').map(header => header.trim());
        const dataRows = lines.slice(1).map(line => line.split(',').map(cell => cell.trim()));

        // Create table headers
        let headerRow = '<tr>';
        headers.forEach(header => {
            headerRow += `<th>${header}</th>`;
        });
        headerRow += '</tr>';

        document.querySelector('#heat-table thead').innerHTML = headerRow;

        // Create table body rows
        dataRows.forEach(row => {
            let tableRow = '<tr>';
            row.forEach(cell => {
                // Check if the cell contains a name with brackets (judge's name)
                const judgeMatch = cell.match(/^(.*)\((.*)\)$/);
                if (judgeMatch) {
                    const participant = judgeMatch[1].trim();
                    const judge = judgeMatch[2].trim();
                    tableRow += `<td>${participant}<br><span style="font-size: 0.8em; color: gray;">(${judge})</span></td>`;
                } else {
                    tableRow += `<td>${cell}</td>`;
                }
            });
            tableRow += '</tr>';
            heatTableBody.innerHTML += tableRow;
        });
    } else {
        document.querySelector('#heat-table thead').innerHTML = '<tr><th>Heat</th><th>Description</th></tr>';
        heatTableBody.innerHTML = `<tr><td>${heatKey}</td><td>${heatDescription}</td></tr>`;
    }

    // Update the active subtab
    const subtabs = document.querySelectorAll('#heats-subtabs .subtab');
    subtabs.forEach(subtab => subtab.classList.remove('active'));
    document.querySelector(`#heats-subtabs .subtab[onclick="showHeat(${heatNumber})"]`).classList.add('active');
}   


fetch('announcements.csv')
        .then(response => response.text())
        .then(data => {
            const rows = data.split('\n').slice(1).filter(row => row.trim() !== '');
            const announcements = [];

            rows.forEach(row => {
                const [timestamp, ...announcementParts] = row.split(',');
                const announcement = announcementParts.join(',').trim();
                announcements.push({ timestamp: timestamp.trim(), announcement });
            });

            displayAnnouncements(announcements);

            // Debug: Log the parsed announcements data to ensure it's correct
            console.log('Announcements Data:', announcements);
        })
        .catch(error => {
            console.error('Error fetching announcements CSV data:', error);
        });

    function displayAnnouncements(announcements) {
        const announcementList = document.getElementById('announcement-list');
        announcementList.innerHTML = ''; // Clear previous announcements

        announcements.forEach(({ timestamp, announcement }) => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `<strong>${timestamp}</strong>: ${announcement}`;
            announcementList.appendChild(listItem);
        });
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
