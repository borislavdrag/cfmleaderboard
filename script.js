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
                    workouts[i] = parseWorkoutCSV(text, i);
                }
            } catch (error) {
                console.log(`Workout 25.${i} data not available yet`);
            }
        }

        // Process and display the data
        const { menData, womenData } = processLeaderboardData(workouts);
        renderTable(menData, 'men');
        renderTable(womenData, 'women');
        
        // Load and display kids leaderboard
        try {
            const kidsResponse = await fetch('leaderboard_kids.csv');
            if (kidsResponse.ok) {
                const kidsText = await kidsResponse.text();
                const kidsData = parseKidsCSV(kidsText);
                renderKidsTable(kidsData, 'kids');
            }
        } catch (error) {
            console.log('Kids leaderboard not available');
        }
        
        // Show initial views
        showWorkout(1);
        showTab('men');
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Helper functions for score handling
function isTimeFormat(score) {
    return typeof score === 'string' && /^\d{1,2}:\d{2}$/.test(score);
}

function parseTime(timeStr) {
    if (!timeStr || !isTimeFormat(timeStr)) return 999999;
    const [minutes, seconds] = timeStr.split(':').map(Number);
    return minutes * 60 + seconds;
}

function compareScores(a, b, workoutNum) {
    // RX always ranks higher than SC
    if (a.rx !== b.rx) return a.rx ? -1 : 1;
    
    // For workout 2
    if (workoutNum === 2) {
        const aIsTime = isTimeFormat(a.scoreRaw);
        const bIsTime = isTimeFormat(b.scoreRaw);
        
        // Time scores rank higher than rep scores
        if (aIsTime !== bIsTime) return aIsTime ? -1 : 1;
        
        // Both are times - lower is better
        if (aIsTime) return parseTime(a.scoreRaw) - parseTime(b.scoreRaw);
        
        // Both are reps - higher is better
        if (a.score !== b.score) return b.score - a.score;
        
        // Equal reps - use tiebreak
        return parseTime(a.tiebreak) - parseTime(b.tiebreak);
    }
    
    // For workout 1 (and future workouts)
    if (a.score !== b.score) return b.score - a.score;  // Higher is better
    
    // If scores are equal, use tiebreak if available
    if (a.tiebreak && b.tiebreak) return parseTime(a.tiebreak) - parseTime(b.tiebreak);
    if (a.tiebreak) return -1;
    if (b.tiebreak) return 1;
    return 0;
}

function parseWorkoutCSV(csvText, workoutNum) {
    const entriesByName = new Map();
    
    csvText.split('\n')
        .slice(1)
        .filter(row => row.trim())
        .forEach(row => {
            const [category, name, version, score, tiebreak] = row.split(',').map(cell => cell.trim());
            
            const entry = {
                category: category.toLowerCase(),
                name,
                scoreRaw: score,
                score: isTimeFormat(score) ? parseTime(score) : parseInt(score) || 0,
                tiebreak: tiebreak || '',
                rx: version.toLowerCase() === 'rx',
                workoutNum
            };
            
            if (entriesByName.has(name)) {
                entriesByName.get(name).push(entry);
            } else {
                entriesByName.set(name, [entry]);
            }
        });
    
    return Array.from(entriesByName.values())
        .map(entries => entries.sort((a, b) => compareScores(a, b, workoutNum))[0]);
}

function calculateWorkoutRanks(participants, workoutNum) {
    // Sort participants using our comparison function
    const sortedParticipants = [...participants].sort((a, b) => 
        compareScores(a, b, workoutNum)
    );

    // Assign 1224 ranks
    const ranks = {};
    let currentRank = 1;
    let sameRankCount = 1;
    let lastPerformance = null;
    let nextAvailableRank = 1; // Track the next available rank

    sortedParticipants.forEach((participant, index) => {
        const performance = {
            rx: participant.rx,
            score: participant.score,
            scoreRaw: participant.scoreRaw,
            tiebreak: participant.tiebreak
        };
        
        if (index === 0) {
            // First participant gets rank 1
            ranks[participant.name] = {
                rank: currentRank,
                score: participant.score,
                scoreRaw: participant.scoreRaw,
                tiebreak: participant.tiebreak,
                rx: participant.rx,
                workoutNum
            };
            lastPerformance = performance;
        } else {
            // Check if this performance matches the previous one
            const sameAsPrevious = JSON.stringify(performance) === JSON.stringify(lastPerformance);
            
            if (sameAsPrevious) {
                // Same performance = same rank
                sameRankCount++;
            } else {
                // Different performance = new rank (skip ranks equal to number of tied athletes)
                currentRank += sameRankCount;
                sameRankCount = 1;
                lastPerformance = performance;
            }
            
            ranks[participant.name] = {
                rank: currentRank,
                score: participant.score,
                scoreRaw: participant.scoreRaw,
                tiebreak: participant.tiebreak,
                rx: participant.rx,
                workoutNum
            };
        }
        nextAvailableRank = currentRank + sameRankCount; // Update next available rank
    });

    // Store the next available rank in the ranks object
    ranks.nextAvailableRank = nextAvailableRank;
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
        const workoutNumber = parseInt(workoutNum);
        const menParticipants = participants.filter(p => p.category === 'men');
        const womenParticipants = participants.filter(p => p.category === 'women');
        
        // Calculate ranks for this specific workout
        const menRanks = calculateWorkoutRanks(menParticipants, workoutNumber);
        const womenRanks = calculateWorkoutRanks(womenParticipants, workoutNumber);
        
        // Apply workout data to each participant
        menData.forEach((participant, name) => {
            if (name in menRanks) {
                participant.workouts[workoutNumber] = menRanks[name];
            } else {
                // Missing workout - assign next available rank
                participant.workouts[workoutNumber] = {
                    rank: menRanks.nextAvailableRank,
                    score: 0,
                    scoreRaw: '',
                    tiebreak: '',
                    rx: false,
                    workoutNum: workoutNumber
                };
            }
        });
        
        womenData.forEach((participant, name) => {
            if (name in womenRanks) {
                participant.workouts[workoutNumber] = womenRanks[name];
            } else {
                // Missing workout - assign next available rank
                participant.workouts[workoutNumber] = {
                    rank: womenRanks.nextAvailableRank,
                    score: 0,
                    scoreRaw: '',
                    tiebreak: '',
                    rx: false,
                    workoutNum: workoutNumber
                };
            }
        });
    });
    
    // Calculate points and convert to arrays
    const menArray = Array.from(menData.values());
    const womenArray = Array.from(womenData.values());
    
    // Calculate points for each participant
    menArray.forEach(participant => {
        participant.points = Object.values(participant.workouts)
            .reduce((sum, workout) => sum + workout.rank, 0);
    });
    
    womenArray.forEach(participant => {
        participant.points = Object.values(participant.workouts)
            .reduce((sum, workout) => sum + workout.rank, 0);
    });
    
    return {
        menData: calculateOverallRanks(menArray),
        womenData: calculateOverallRanks(womenArray)
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
            
            // If no score (missing workout), show the rank they get for missing it
            if (!workout.scoreRaw && !workout.tiebreak) {
                return `
                    <td>
                        <div class="workout-cell">
                            <span class="workout-rank">${workout.rank}</span>
                            <span class="workout-score">—</span>
                        </div>
                    </td>
                `;
            }
            
            // For workout 2:
            // - Show tiebreak if it exists
            // - For rep scores without tiebreak, show default 12:00
            let tiebreakToShow = workout.tiebreak;
            if (workoutNum === 2 && !isTimeFormat(workout.scoreRaw) && !workout.tiebreak) {
                tiebreakToShow = '12:00';
            }
            
            return `
                <td>
                    <div class="workout-cell">
                        <span class="workout-rank">${workout.rank}</span>
                        <span class="workout-rx">${workout.rx ? 'rx' : 'sc'}</span>
                        <span class="workout-score">
                            ${workout.scoreRaw}${tiebreakToShow ? 
                                `<span class="workout-tiebreak">(${tiebreakToShow})</span>` : 
                                ''}
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

// Add function to parse kids CSV
function parseKidsCSV(csvText) {
    const kidsData = [];
    
    csvText.split('\n')
        .slice(1)  // Skip header
        .filter(row => row.trim())
        .forEach(row => {
            const [name, age, score, weight] = row.split(',').map(cell => cell.trim());
            kidsData.push({
                name,
                age: age || '',
                score,
                weight
            });
        });
    
    return kidsData;
}

// Update function to render kids table
function renderKidsTable(data, tableId) {
    const table = document.getElementById(tableId);
    const tbody = table.querySelector('tbody');
    tbody.innerHTML = '';
    
    data.forEach(kid => {
        const row = `
            <tr>
                <td>${kid.name}</td>
                <td>${kid.age}</td>
                <td>
                    <div class="kids-workout-cell">
                        <span class="kids-workout-score">${kid.score}</span>
                        <span class="workout-weight">(${kid.weight}kg)</span>
                    </div>
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}
