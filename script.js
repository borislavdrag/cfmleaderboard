document.addEventListener('DOMContentLoaded', function() {
    loadLeaderboards();
});

async function loadLeaderboards() {
    try {
        // Load all available workout data
        const workouts = {};
        for (let i = 1; i <= 3; i++) {
            try {
                const response = await fetch(`leaderboard_25_${i}.csv`);
                if (response.ok) {
                    const text = await response.text();
                    workouts[i] = parseWorkoutCSV(text);
                }
            } catch (error) {
                console.log(`Workout 25.${i} data not available yet`);
            }
        }

        // Process and display the data
        const { menData, womenData } = processLeaderboardData(workouts);
        renderTable(menData, 'men');
        renderTable(womenData, 'women');
        
        // Show initial views
        showWorkout(1);
        showTab('men');
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

function parseWorkoutCSV(csvText) {
    return csvText
        .split('\n')
        .slice(1) // Skip header
        .filter(row => row.trim())
        .map(row => {
            const [category, name, version, score, tiebreak] = row.split(',').map(cell => cell.trim());
            return {
                category: category.toLowerCase(),
                name,
                score: parseInt(score) || 0,
                tiebreak: tiebreak || '',
                rx: version.toLowerCase() === 'rx'
            };
        });
}

function calculateWorkoutRanks(participants) {
    // Get the last place rank (total number of participants + 1)
    const lastPlace = participants.length + 1;
    
    return participants
        .sort((a, b) => {
            // RX always above SC
            if (a.rx !== b.rx) return a.rx ? -1 : 1;
            
            // Higher score is better
            if (a.score !== b.score) return b.score - a.score;
            
            // If scores are equal, use tiebreak
            return a.tiebreak.localeCompare(b.tiebreak);
        })
        .reduce((ranks, participant, index) => {
            ranks[participant.name] = {
                rank: index + 1,
                score: participant.score,
                tiebreak: participant.tiebreak,
                rx: participant.rx
            };
            return ranks;
        }, {});
}

function processLeaderboardData(workouts) {
    const menData = new Map();
    const womenData = new Map();
    
    // First pass: collect all participant names
    Object.values(workouts).forEach(participants => {
        participants.forEach(p => {
            const data = p.category === 'men' ? menData : womenData;
            if (!data.has(p.name)) {
                data.set(p.name, { name: p.name, workouts: {}, points: 0 });
            }
        });
    });
    
    // Second pass: process workouts and calculate ranks
    Object.entries(workouts).forEach(([workoutNum, participants]) => {
        const menParticipants = participants.filter(p => p.category === 'men');
        const womenParticipants = participants.filter(p => p.category === 'women');
        
        // Last place is the number of participants in this workout + 1
        const menLastPlace = menParticipants.length + 1;
        const womenLastPlace = womenParticipants.length + 1;
        
        const menRanks = calculateWorkoutRanks(menParticipants);
        const womenRanks = calculateWorkoutRanks(womenParticipants);
        
        // Add workout data to participants
        [
            [menData, menRanks, menLastPlace],
            [womenData, womenRanks, womenLastPlace]
        ].forEach(([data, ranks, lastPlace]) => {
            data.forEach((participant, name) => {
                const result = ranks[name] || {
                    rank: lastPlace,
                    score: 0,
                    tiebreak: '',
                    rx: false
                };
                participant.workouts[workoutNum] = result;
                participant.points = Object.values(participant.workouts)
                    .reduce((sum, workout) => sum + workout.rank, 0);
            });
        });
    });
    
    // Calculate overall ranks
    function calculateOverallRanks(data) {
        return Array.from(data.values())
            .sort((a, b) => a.points - b.points)
            .map((participant, index) => {
                participant.overallRank = index + 1;
                return participant;
            });
    }
    
    return {
        menData: calculateOverallRanks(menData),
        womenData: calculateOverallRanks(womenData)
    };
}

function renderTable(data, tableId) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    tbody.innerHTML = '';
    
    data.forEach(participant => {
        const workoutCells = [1, 2, 3].map(workoutNum => {
            const workout = participant.workouts[workoutNum];
            if (!workout) {
                return '<td></td>';
            }
            
            // If no score (empty workout), show rank and dash
            if (!workout.score && !workout.tiebreak) {
                return `
                    <td>
                        <div class="workout-cell">
                            <span class="workout-rank">${workout.rank}</span>
                            <span class="workout-score">
                                <span class="workout-empty">—</span>
                            </span>
                        </div>
                    </td>
                `;
            }
            
            return `
                <td>
                    <div class="workout-cell">
                        <span class="workout-rank">${workout.rank}</span>
                        <span class="workout-rx">${workout.rx ? 'rx' : 'sc'}</span>
                        <span class="workout-score">
                            ${workout.score}${workout.tiebreak ? `<span class="workout-tiebreak">(${workout.tiebreak})</span>` : ''}
                        </span>
                    </div>
                </td>
            `;
        }).join('');
        
        const row = `
            <tr>
                <td>${participant.name}</td>
                <td class="overall-rank">${participant.overallRank}</td>
                <td class="overall-points">${participant.points}</td>
                ${workoutCells}
            </tr>
        `;
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
    
    // Fetch the workout description from the corresponding file
    fetch(`25_${workoutNumber}.txt`)
        .then(response => response.text())
        .then(data => {
            workoutDetails.innerHTML = data.replace(/\n/g, '<br>');
        })
        .catch(error => {
            console.error('Error loading workout:', error);
            workoutDetails.innerHTML = 'Error loading workout details';
        });

    const subtabs = document.querySelectorAll('#workout-subtabs .subtab');
    subtabs.forEach(subtab => subtab.classList.remove('active'));
    document.querySelector(`#workout-subtabs .subtab[onclick="showWorkout(${workoutNumber})"]`).classList.add('active');
};

let currentSort = {
    column: null,
    direction: null
};

window.sortTable = function(tableId, column) {
    const table = document.getElementById(tableId);
    
    // Set initial direction or toggle existing
    if (currentSort.column !== column) {
        currentSort.column = column;
        currentSort.direction = 'asc';  // Always start with ascending
    } else {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    }

    // Update header arrows
    const headers = table.querySelectorAll('th');
    headers.forEach(header => {
        header.classList.remove('sorted-asc', 'sorted-desc');
    });
    const currentHeader = table.querySelector(`th[onclick="sortTable('${tableId}', '${column}')"]`);
    currentHeader.classList.add(`sorted-${currentSort.direction}`);

    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));

    // Sort the rows
    rows.sort((a, b) => {
        let valueA, valueB;

        switch(column) {
            case 'name':
                valueA = a.cells[0].textContent;
                valueB = b.cells[0].textContent;
                return currentSort.direction === 'asc' 
                    ? valueA.localeCompare(valueB)
                    : valueB.localeCompare(valueA);

            case 'rank':
                valueA = parseInt(a.cells[1].textContent);
                valueB = parseInt(b.cells[1].textContent);
                break;

            case 'points':
                valueA = parseInt(a.cells[2].textContent);
                valueB = parseInt(b.cells[2].textContent);
                break;

            case 'workout1':
            case 'workout2':
            case 'workout3':
                const workoutIndex = parseInt(column.slice(-1));
                valueA = parseInt(a.cells[workoutIndex + 2].querySelector('.workout-rank').textContent);
                valueB = parseInt(b.cells[workoutIndex + 2].querySelector('.workout-rank').textContent);
                break;
        }

        if (currentSort.direction === 'asc') {
            return valueA - valueB;
        } else {
            return valueB - valueA;
        }
    });

    // Reinsert rows in new order
    rows.forEach(row => tbody.appendChild(row));
};
