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
    // First, collect all entries for each person
    const entriesByName = new Map();
    
    csvText
        .split('\n')
        .slice(1) // Skip header
        .filter(row => row.trim())
        .forEach(row => {
            const [category, name, version, score, tiebreak] = row.split(',').map(cell => cell.trim());
            
            // Create entry object with parsed score
            const entry = {
                category: category.toLowerCase(),
                name,
                scoreRaw: score,
                score: parseScore(score),
                tiebreak: tiebreak || '',
                rx: version.toLowerCase() === 'rx',
                isTime: isTimeFormat(score)
            };
            
            // If we already have entries for this name, add to array, otherwise create new array
            if (entriesByName.has(name)) {
                entriesByName.get(name).push(entry);
            } else {
                entriesByName.set(name, [entry]);
            }
        });
    
    // Then, for each person, select their best entry
    return Array.from(entriesByName.values()).map(entries => {
        // Sort entries by:
        // 1. RX over SC
        // 2. Higher score for reps, lower score for time
        // 3. Better tiebreak (lower is better)
        return entries.sort((a, b) => {
            // RX always above SC
            if (a.rx !== b.rx) return a.rx ? -1 : 1;
            
            // For time scores (lower is better)
            if (a.isTime && b.isTime) {
                if (a.score !== b.score) return a.score - b.score;
            } 
            // For rep scores (higher is better)
            else if (!a.isTime && !b.isTime) {
                if (a.score !== b.score) return b.score - a.score;
            }
            // Mixed types (shouldn't happen, but just in case)
            else {
                return a.isTime ? 1 : -1; // Prioritize non-time scores
            }
            
            // If scores are equal, use tiebreak (lower is better)
            if (a.tiebreak && b.tiebreak) {
                const tiebreakA = parseFloat(a.tiebreak);
                const tiebreakB = parseFloat(b.tiebreak);
                return tiebreakA - tiebreakB;
            }
            
            // If only one has a tiebreak, they win
            if (a.tiebreak) return -1;
            if (b.tiebreak) return 1;
            
            // If no tiebreaks, they're equal
            return 0;
        })[0]; // Take the first (best) entry
    });
}

// Helper function to check if a score is in time format (MM:SS or M:SS)
function isTimeFormat(score) {
    return /^\d{1,2}:\d{2}$/.test(score);
}

// Helper function to parse scores
function parseScore(score) {
    if (isTimeFormat(score)) {
        // Convert time format (MM:SS) to seconds for comparison
        const [minutes, seconds] = score.split(':').map(Number);
        return minutes * 60 + seconds;
    } else {
        // For rep counts, just convert to number
        return parseInt(score) || 0;
    }
}

function calculateWorkoutRanks(participants) {
    // First sort participants
    const sortedParticipants = [...participants].sort((a, b) => {
        // RX always above SC
        if (a.rx !== b.rx) return a.rx ? -1 : 1;
        
        // Check if scores are time-based (lower is better)
        if (a.isTime && b.isTime) {
            if (a.score !== b.score) return a.score - b.score;
        } 
        // For rep scores (higher is better)
        else if (!a.isTime && !b.isTime) {
            if (a.score !== b.score) return b.score - a.score;
        }
        // Mixed types (shouldn't happen, but just in case)
        else {
            return a.isTime ? 1 : -1; // Prioritize non-time scores
        }
        
        // If scores are equal, use tiebreak (lower is better)
        if (a.tiebreak && b.tiebreak) {
            const tiebreakA = parseFloat(a.tiebreak);
            const tiebreakB = parseFloat(b.tiebreak);
            return tiebreakA - tiebreakB;
        }
        
        // If only one has a tiebreak, they win
        if (a.tiebreak) return -1;
        if (b.tiebreak) return 1;
        
        // If no tiebreaks, they're equal
        return 0;
    });

    // Then assign ranks with 1224 ranking
    const ranks = {};
    let currentRank = 1;
    let nextRank = 1;
    let lastRx = null;
    let lastScore = null;
    let lastTiebreak = null;
    let lastIsTime = null;

    sortedParticipants.forEach((participant, index) => {
        // Check if this is a new performance level
        const newPerformance = 
            index === 0 || 
            participant.rx !== lastRx || 
            participant.score !== lastScore || 
            participant.tiebreak !== lastTiebreak ||
            participant.isTime !== lastIsTime;
            
        if (newPerformance) {
            // Start new rank group
            currentRank = nextRank;
            
            // Update last values
            lastRx = participant.rx;
            lastScore = participant.score;
            lastTiebreak = participant.tiebreak;
            lastIsTime = participant.isTime;
        }
        
        // Assign rank to this participant
        ranks[participant.name] = {
            rank: currentRank,
            score: participant.score,
            scoreRaw: participant.scoreRaw,
            tiebreak: participant.tiebreak,
            rx: participant.rx,
            isTime: participant.isTime
        };
        
        // Next rank will be current index + 1
        nextRank = index + 2;
    });

    return ranks;
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
        
        // Calculate ranks using our 1224 system
        const menRanks = calculateWorkoutRanks(menParticipants);
        const womenRanks = calculateWorkoutRanks(womenParticipants);
        
        // Apply workout data to each participant
        menData.forEach((participant, name) => {
            // If participant did this workout, use their rank, otherwise use a "did not participate" rank
            if (name in menRanks) {
                participant.workouts[workoutNum] = menRanks[name];
            } else {
                participant.workouts[workoutNum] = {
                    rank: menParticipants.length + 1, // Last place + 1
                    score: 0,
                    scoreRaw: '',
                    tiebreak: '',
                    rx: false,
                    isTime: false
                };
            }
        });
        
        womenData.forEach((participant, name) => {
            if (name in womenRanks) {
                participant.workouts[workoutNum] = womenRanks[name];
            } else {
                participant.workouts[workoutNum] = {
                    rank: womenParticipants.length + 1, // Last place + 1
                    score: 0,
                    scoreRaw: '',
                    tiebreak: '',
                    rx: false,
                    isTime: false
                };
            }
        });
    });
    
    // Calculate points for each participant
    menData.forEach(participant => {
        participant.points = Object.values(participant.workouts)
            .reduce((sum, workout) => sum + workout.rank, 0);
    });
    
    womenData.forEach(participant => {
        participant.points = Object.values(participant.workouts)
            .reduce((sum, workout) => sum + workout.rank, 0);
    });
    
    return {
        menData: calculateOverallRanks(menData),
        womenData: calculateOverallRanks(womenData)
    };
}

function calculateOverallRanks(data) {
    const participants = Array.from(data.values());
    
    // Sort participants by points and tiebreakers
    const sortedParticipants = [...participants].sort((a, b) => {
        // First compare points
        if (a.points !== b.points) {
            return a.points - b.points;
        }

        // If points are equal, compare best ranks
        const aRanks = Object.values(a.workouts)
            .map(w => w.rank)
            .sort((x, y) => x - y);
        const bRanks = Object.values(b.workouts)
            .map(w => w.rank)
            .sort((x, y) => x - y);

        // Compare each rank position until we find a difference
        for (let i = 0; i < Math.min(aRanks.length, bRanks.length); i++) {
            if (aRanks[i] !== bRanks[i]) {
                return aRanks[i] - bRanks[i];
            }
        }

        // If tied so far, the one with more workouts wins
        if (aRanks.length !== bRanks.length) {
            return bRanks.length - aRanks.length;
        }

        // If all ranks are identical, they should tie
        return 0;
    });

    // Assign proper 1224 ranks
    let currentRank = 1;
    let prevPoints = null;
    let prevRanks = null;
    let sameRankCount = 0;
    
    for (let i = 0; i < sortedParticipants.length; i++) {
        const participant = sortedParticipants[i];
        const participantRanks = Object.values(participant.workouts)
            .map(w => w.rank)
            .sort((x, y) => x - y)
            .join(','); // Convert to string for easy comparison
        
        if (i === 0) {
            // First participant
            participant.overallRank = 1;
            prevPoints = participant.points;
            prevRanks = participantRanks;
            sameRankCount = 1;
        } else {
            const samePerformance = 
                participant.points === prevPoints && 
                participantRanks === prevRanks;
                
            if (samePerformance) {
                // Same rank as previous
                participant.overallRank = currentRank;
                sameRankCount++;
            } else {
                // New rank = previous rank + number with that rank
                currentRank += sameRankCount;
                participant.overallRank = currentRank;
                prevPoints = participant.points;
                prevRanks = participantRanks;
                sameRankCount = 1;
            }
        }
    }

    return sortedParticipants;
}

function renderTable(data, tableId) {
    const table = document.getElementById(tableId);
    const tbody = table.querySelector('tbody');
    tbody.innerHTML = '';
    
    data.forEach(participant => {
        const workoutCells = [1, 2, 3].map(workoutNum => {
            const workout = participant.workouts[workoutNum];
            if (!workout) {
                return '<td></td>';
            }
            
            // If no score (empty workout), show empty cell
            if (!workout.score && !workout.tiebreak) {
                return `
                    <td>
                        <div class="workout-cell">
                            <span class="workout-empty">—</span>
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
                            ${workout.scoreRaw || workout.score}${workout.tiebreak ? `<span class="workout-tiebreak">(${workout.tiebreak})</span>` : ''}
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
