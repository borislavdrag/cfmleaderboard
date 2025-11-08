const {
  createApp,
  reactive,
  computed,
  onMounted,
  watch,
  toRefs,
} = window.Vue;

const WORKOUTS_PATH = 'workouts.json';
const POINTS_BASE = 100;
const POINTS_STEP = 3;
const POINT_SCALE_OVERRIDES = {
  WOD5: {
    men: { base: 100, step: 10 },
    women: { base: 100, step: 25 },
    masters: { base: 100, step: 25 },
  },
};

const DIVISIONS = [
  { value: 'men', label: 'Men' },
  { value: 'women', label: 'Women' },
  { value: 'masters', label: 'Masters' },
];

const DEFAULT_WORKOUTS = [
  { id: 'WOD1', title: 'WOD 1', focus: 'For time', description: 'Update workouts.json to change this description.', status: 'Announced' },
  { id: 'WOD2', title: 'WOD 2', focus: 'Max reps', description: 'Update workouts.json to change this description.', status: 'Announced' },
  { id: 'WOD3', title: 'WOD 3', focus: 'Skill ladder', description: 'Update workouts.json to change this description.', status: 'Announced' },
  { id: 'WOD4', title: 'WOD 4', focus: 'Heavy day', description: 'Update workouts.json to change this description.', status: 'Announced' },
  { id: 'WOD5', title: 'WOD 5', focus: 'Finale', description: 'Update workouts.json to change this description.', status: 'Announced' },
].map((workout, index) => normalizeWorkoutDefinition(workout, index));

const TIME_REGEX = /^\d{1,2}:\d{2}$/;

const normalizeKey = (value = '') => value.toString().trim().toLowerCase();

function normalizeWorkoutDefinition(workout, index = 0) {
  const fallbackId = `WOD${index + 1}`;
  const id = (workout?.id || fallbackId).toString().trim().toUpperCase();
  return {
    id,
    title: workout?.title || id,
    focus: workout?.focus || 'Competition workout',
    description: workout?.description || 'Update workouts.json to change this description.',
    status: workout?.status || 'Scheduled',
  };
}

const divisionSummaryLabel = DIVISIONS.map((division) => division.label).join(' · ');

const sanitizeNumber = (value = '') => {
  const numeric = Number(value.toString().replace(',', '.'));
  return Number.isNaN(numeric) ? null : numeric;
};

const parseTime = (timeStr = '') => {
  if (!TIME_REGEX.test(timeStr)) return Number.POSITIVE_INFINITY;
  const [minutes, seconds] = timeStr.split(':').map(Number);
  return minutes * 60 + seconds;
};

const detectScoreMeta = (raw) => {
  const cleaned = (raw ?? '').toString().trim();
  if (!cleaned) {
    return { type: 'none', value: null };
  }

  if (TIME_REGEX.test(cleaned)) {
    return { type: 'time', value: parseTime(cleaned) };
  }

  const numeric = sanitizeNumber(cleaned);
  if (numeric !== null) {
    return { type: 'number', value: numeric };
  }

  return { type: 'text', value: cleaned };
};

const scoreTypePriority = { time: 0, number: 1, text: 2, none: 3 };

const compareEntries = (a, b) => {
  if (a.rxFlag !== b.rxFlag) {
    return a.rxFlag ? -1 : 1;
  }
  const priorityDiff = scoreTypePriority[a.scoreType] - scoreTypePriority[b.scoreType];
  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  if (a.scoreType === 'time' && b.scoreType === 'time') {
    return a.scoreValue - b.scoreValue;
  }

  if (a.scoreType === 'number' && b.scoreType === 'number') {
    if (a.scoreValue !== b.scoreValue) {
      return b.scoreValue - a.scoreValue;
    }
  }

  const tieA = a.tiebreakValue ?? Number.POSITIVE_INFINITY;
  const tieB = b.tiebreakValue ?? Number.POSITIVE_INFINITY;
  if (tieA !== tieB) {
    return tieA - tieB;
  }

  return 0;
};

const getPointScale = (workoutId, division) =>
  POINT_SCALE_OVERRIDES[workoutId]?.[division] || null;

const calculatePoints = (rankIndex, workoutId, division) => {
  const scale = getPointScale(workoutId, division);
  const base = scale?.base ?? POINTS_BASE;
  const step = scale?.step ?? POINTS_STEP;
  return Math.max(0, base - step * rankIndex);
};

const tryParseJson = (payload) => {
  try {
    return JSON.parse(payload);
  } catch (_) {
    return null;
  }
};

const parseCsv = (text) => {
  const rows = [];
  let current = '';
  let inQuotes = false;
  const pushCell = (row) => {
    row.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
    current = '';
  };
  const pushRow = (row) => {
    if (row.length) {
      rows.push(row);
    }
  };

  let row = [];
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      pushCell(row);
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (current || row.length) {
        pushCell(row);
        pushRow(row);
        row = [];
      }
      if (char === '\r' && text[i + 1] === '\n') {
        i += 1;
      }
    } else {
      current += char;
    }
  }
  if (current || row.length) {
    pushCell(row);
    pushRow(row);
  }
  if (!rows.length) {
    return [];
  }

  const headers = rows.shift().map((header) => normalizeKey(header).replace(/\s+/g, '_'));

  return rows
    .filter((cells) => cells.some((cell) => cell.trim().length))
    .map((cells) => {
      const record = {};
      headers.forEach((header, idx) => {
        record[header] = cells[idx] || '';
      });
      return record;
    });
};

const normalizeDivision = (raw) => {
  const text = normalizeKey(raw);
  if (text.includes('master')) {
    return { value: 'masters', label: 'Masters' };
  }
  if (text.includes('women') || text.includes('female') || text.includes('ladies') || text.includes('girl')) {
    return { value: 'women', label: 'Women' };
  }
  return { value: 'men', label: 'Men' };
};

const buildEntriesFromRecords = (records) => {
  if (!Array.isArray(records) || !records.length) {
    return [];
  }

  const entries = [];

  records.forEach((record, index) => {
    const divisionData = normalizeDivision(
      record.division || record.category || record.division_name || record.gender || 'Men',
    );

    const workoutRaw =
      record.workout || record.workout_id || record.event || record.event_title || `WOD${index + 1}`;
    const workoutId = workoutRaw.toString().trim().toUpperCase();

    const name =
      record.name || record.athlete || record.full_name || record.athlete_name || `Athlete ${index + 1}`;
    const scoreRaw = record.score || record.result || record.time || '';
    const tiebreakRaw =
      record.tiebreak || record.tie_break || record.tiebreaker || record.tie || '';

    const scoreMeta = detectScoreMeta(scoreRaw);
    const tiebreakMeta = detectScoreMeta(tiebreakRaw);

    const rxSource = record.rx ?? record.version ?? record.scaled ?? record.is_rx ?? '';
    const rxBoolean = typeof rxSource === 'string'
      ? ['rx', 'yes', 'true'].includes(rxSource.trim().toLowerCase())
      : Boolean(rxSource);
    const rxLabel = rxBoolean ? 'Yes' : 'No';

    const entry = {
      id: `${divisionData.value}-${workoutId}-${index}`,
      division: divisionData.value,
      divisionLabel: divisionData.label,
      workoutId,
      workoutTitle: workoutId,
      name,
      score: scoreRaw,
      tiebreak: tiebreakRaw,
      rx: rxLabel,
      rxFlag: rxBoolean,
      scoreType: scoreMeta.type,
      scoreValue: scoreMeta.value,
      tiebreakValue: tiebreakMeta.type === 'time' ? tiebreakMeta.value : null,
      points: null,
      rank: null,
    };

    entries.push(entry);
  });

  const buckets = new Map();
  entries.forEach((entry) => {
    const key = `${entry.division}__${entry.workoutId}`;
    if (!buckets.has(key)) {
      buckets.set(key, []);
    }
    buckets.get(key).push(entry);
  });

  buckets.forEach((list) => {
    list.sort(compareEntries);
    let index = 0;
    while (index < list.length) {
      let groupEnd = index + 1;
      while (
        groupEnd < list.length &&
        compareEntries(list[index], list[groupEnd]) === 0
      ) {
        groupEnd += 1;
      }
      const baseEntry = list[index];
      const points = calculatePoints(index, baseEntry.workoutId, baseEntry.division);
      for (let i = index; i < groupEnd; i += 1) {
        list[i].rank = index + 1;
        list[i].points = points;
      }
      index = groupEnd;
    }
  });

  return entries;
};

const compareAthletesByTotals = (a, b) => {
  const totalDiff = (b.totalPoints ?? 0) - (a.totalPoints ?? 0);
  if (totalDiff !== 0) {
    return totalDiff;
  }

  const maxLen = Math.max(
    a.sortedWorkoutPoints.length,
    b.sortedWorkoutPoints.length,
  );
  for (let i = 0; i < maxLen; i += 1) {
    const pointsA = a.sortedWorkoutPoints[i] ?? 0;
    const pointsB = b.sortedWorkoutPoints[i] ?? 0;
    if (pointsB !== pointsA) {
      return pointsB - pointsA;
    }
  }
  return 0;
};

const aggregateLeaderboards = (entries) => {
  const maps = DIVISIONS.reduce((acc, division) => {
    acc[division.value] = new Map();
    return acc;
  }, {});

  entries.forEach((entry) => {
    if (!maps[entry.division]) return;
    const key = normalizeKey(entry.name);
    if (!maps[entry.division].has(key)) {
      maps[entry.division].set(key, {
        name: entry.name,
        totalPoints: 0,
        workouts: {},
      });
    }
    const athlete = maps[entry.division].get(key);
    athlete.workouts[entry.workoutId] = {
      score: entry.score || '—',
      tiebreak: entry.tiebreak || '',
      points: entry.points ?? null,
      rxFlag: entry.rxFlag,
    };
    athlete.totalPoints += entry.points ?? 0;
  });

  return DIVISIONS.reduce((acc, division) => {
    const athletes = Array.from(maps[division.value].values()).map(
      (athlete) => ({
        ...athlete,
        sortedWorkoutPoints: Object.values(athlete.workouts)
          .map((workout) => workout.points ?? 0)
          .sort((a, b) => b - a),
      }),
    );

    athletes.sort((a, b) => {
      const result = compareAthletesByTotals(a, b);
      if (result !== 0) return result;
      return a.name.localeCompare(b.name);
    });

    athletes.forEach((athlete, index) => {
      if (
        index > 0 &&
        compareAthletesByTotals(athletes[index - 1], athlete) === 0
      ) {
        athlete.rank = athletes[index - 1].rank;
      } else {
        athlete.rank = index + 1;
      }
    });

    acc[division.value] = athletes;
    return acc;
  }, {});
};

const app = createApp({
  setup() {
    const state = reactive({
      config: window.CFM_CONFIG || {},
      entries: [],
      workouts: DEFAULT_WORKOUTS.slice(),
      activeDivision: DIVISIONS[0].value,
      isLoading: true,
      lastUpdated: null,
      isScoreDrawerOpen: false,
      isAdminPanelOpen: false,
      isAdminUnlocked: false,
      submissionState: 'idle',
      submissionMessage: '',
      scoreForm: {
        name: '',
        division: DIVISIONS[0].value,
        workout: DEFAULT_WORKOUTS[0]?.id || '',
        score: '',
        tiebreak: '',
        rx: true,
      },
      sort: {
        column: 'rank',
        direction: 'asc',
      },
    });

    const divisionLeaderboards = computed(() => aggregateLeaderboards(state.entries));

    const visibleLeaderboard = computed(() => {
      const list = divisionLeaderboards.value[state.activeDivision] || [];
      const { column, direction } = state.sort;
      const multiplier = direction === 'asc' ? 1 : -1;

      const getWorkoutPoints = (athlete, workoutId) =>
        athlete.workouts[workoutId]?.points ?? -1;

      return [...list].sort((a, b) => {
        let valueA;
        let valueB;

        if (column === 'rank') {
          valueA = a.rank ?? Infinity;
          valueB = b.rank ?? Infinity;
        } else if (column === 'totalPoints') {
          valueA = a.totalPoints ?? 0;
          valueB = b.totalPoints ?? 0;
        } else if (column.startsWith('workout:')) {
          const workoutId = column.split(':')[1];
          valueA = getWorkoutPoints(a, workoutId);
          valueB = getWorkoutPoints(b, workoutId);
        } else {
          valueA = a.name;
          valueB = b.name;
        }

        if (valueA === valueB) {
          return a.name.localeCompare(b.name);
        }

        if (typeof valueA === 'number' && typeof valueB === 'number') {
          return (valueA - valueB) * multiplier;
        }

        return valueA.toString().localeCompare(valueB.toString()) * multiplier;
      });
    });
    const workoutColumns = computed(() => state.workouts);

    const lastUpdatedLabel = computed(() => {
      if (!state.lastUpdated) return '—';
      return new Date(state.lastUpdated).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    });

    watch(
      () => state.activeDivision,
      (value) => {
        state.scoreForm.division = value;
      },
      { immediate: true },
    );

    watch(
      () => state.workouts.map((workout) => workout.id),
      (ids) => {
        if (!ids.length) {
          state.scoreForm.workout = '';
          return;
        }
        if (!ids.includes(state.scoreForm.workout)) {
          state.scoreForm.workout = ids[0];
          state.scoreForm.rx = true;
        }
      },
      { immediate: true },
    );

    const toggleScoreDrawer = (open) => {
      state.isScoreDrawerOpen = open;
      if (open) {
        state.submissionState = 'idle';
        state.submissionMessage = '';
      }
    };

    const changeSort = (column) => {
      if (state.sort.column === column) {
        state.sort.direction = state.sort.direction === 'asc' ? 'desc' : 'asc';
        return;
      }

      const defaultDirection =
        column === 'rank' ? 'asc' : column === 'totalPoints' || column.startsWith('workout:') ? 'desc' : 'asc';

      state.sort.column = column;
      state.sort.direction = defaultDirection;
    };

    const getSortClass = (column) => {
      if (state.sort.column !== column) return '';
      return `sorted-${state.sort.direction}`;
    };

    const openAdminPanel = () => {
      if (!state.isAdminUnlocked) {
        const input = window.prompt('Enter admin password');
        const expected = state.config.adminPassword || 'cfm-admin';
        if (input !== expected) {
          window.alert('Incorrect password');
          return;
        }
        state.isAdminUnlocked = true;
      }
      state.isAdminPanelOpen = true;
    };

    const closeAdminPanel = () => {
      state.isAdminPanelOpen = false;
    };

    const loadWorkouts = async () => {
      try {
        const response = await fetch(WORKOUTS_PATH, { cache: 'no-store' });
        if (!response.ok) throw new Error('Unable to fetch workouts.json');
        const data = await response.json();
        if (Array.isArray(data) && data.length) {
        state.workouts = data.map((workout, idx) =>
          normalizeWorkoutDefinition(workout, idx),
        );
          return;
        }
        throw new Error('Workouts file empty');
      } catch (error) {
        console.warn('Falling back to default workouts', error);
        state.workouts = DEFAULT_WORKOUTS.slice();
      }
    };

    const fetchRecords = async () => {
      if (!state.config.leaderboardFeed) {
        state.entries = [];
        state.isLoading = false;
        state.lastUpdated = null;
        return;
      }

      state.isLoading = true;
      try {
        const response = await fetch(state.config.leaderboardFeed, {
          cache: 'no-store',
        });
        const rawPayload = await response.text();

        let records = tryParseJson(rawPayload);
        if (records && !Array.isArray(records)) {
          records = records.records || records.rows || records.data || [];
        }

        if (!records || !records.length) {
          records = parseCsv(rawPayload);
        }

        state.entries = buildEntriesFromRecords(records);
        state.lastUpdated = new Date().toISOString();
      } catch (error) {
        console.error('Unable to fetch leaderboard feed', error);
        state.entries = [];
      } finally {
        state.isLoading = false;
      }
    };

    const submitScore = async () => {
      if (!state.config.scoreEndpoint) {
        state.submissionState = 'error';
        state.submissionMessage = 'Add a scoreEndpoint URL inside config.js to enable submissions.';
        return;
      }

      state.submissionState = 'sending';
      state.submissionMessage = 'Sending score to your endpoint…';

      const payload = {
        division: state.scoreForm.division,
        workout: state.scoreForm.workout,
        name: state.scoreForm.name,
        score: state.scoreForm.score,
        tiebreak: state.scoreForm.tiebreak,
        rx: state.scoreForm.rx ? 'Yes' : 'No',
      };

      if (state.config.submissionToken) {
        payload.token = state.config.submissionToken;
      }

      try {
        const response = await fetch(state.config.scoreEndpoint, {
          method: 'POST',
          headers: (() => {
            const headers = { ...(state.config.scoreEndpointHeaders || {}) };
            const hasContentType = Object.keys(headers).some(
              (key) => key.toLowerCase() === 'content-type',
            );
            if (!hasContentType) {
              headers['Content-Type'] = 'text/plain;charset=utf-8';
            }
            return headers;
          })(),
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const details = await response.text();
          throw new Error(details || 'Endpoint responded with an error.');
        }

        state.submissionState = 'success';
        state.submissionMessage =
          'Score submitted. Refresh the leaderboard once the sheet updates.';
        state.scoreForm.name = '';
        state.scoreForm.score = '';
        state.scoreForm.tiebreak = '';
        state.scoreForm.rx = false;
      } catch (error) {
        state.submissionState = 'error';
        state.submissionMessage = error.message || 'Something went wrong while submitting.';
      }
    };

    const refreshData = async () => {
      await fetchRecords();
    };

    onMounted(async () => {
      await loadWorkouts();
      state.scoreForm.workout = state.workouts[0]?.id || '';
      await refreshData();
    });

    const stateRefs = toRefs(state);

    return {
      config: stateRefs.config,
      workouts: workoutColumns,
      entries: stateRefs.entries,
      activeDivision: stateRefs.activeDivision,
      divisionSummary: divisionSummaryLabel,
      divisionTabs: DIVISIONS,
      visibleLeaderboard,
      isLoading: computed(() => state.isLoading),
      lastUpdatedLabel,
      isScoreDrawerOpen: computed(() => state.isScoreDrawerOpen),
      isAdminPanelOpen: computed(() => state.isAdminPanelOpen),
      toggleScoreDrawer,
      openAdminPanel,
      closeAdminPanel,
      refreshData,
      scoreForm: stateRefs.scoreForm,
      submitScore,
      submissionState: computed(() => state.submissionState),
      submissionMessage: computed(() => state.submissionMessage),
      changeSort,
      getSortClass,
    };
  },
});

app.mount('#app');
