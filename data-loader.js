// ===== Data Loader: React hook that fetches JSON data =====
const { useState, useEffect } = React;

const REACTION_FILES = {
  'CO Oxidation': 'data/co_oxidation.json',
  'NH3-SCR': 'data/nh3_scr.json',
  'C3H6 Combustion': 'data/c3h6_combustion.json',
  'Alkane Dehydrogenation': 'data/alkane_dehydrogenation.json',
  'CO2 Cycloaddition': 'data/co2_cycloaddition.json',
  'F-T Synthesis': 'data/ft_synthesis.json',
};

// Which reactions are real data (vs demo)
const REAL_DATA_REACTIONS = new Set(['CO Oxidation', 'NH3-SCR', 'C3H6 Combustion']);

// Map structures.json keys to reaction keys
const STRUCTURE_KEY_MAP = {
  'CO Oxidation': 'CO 氧化',
  'NH3-SCR': 'NH₃-SCR',
  'C3H6 Combustion': 'C₃H₆ 氧化',
  'Alkane Dehydrogenation': null,
  'CO2 Cycloaddition': null,
  'F-T Synthesis': null,
};

function useReactionData(reactionKey) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const path = REACTION_FILES[reactionKey];
    if (!path) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(path)
      .then(r => {
        if (!r.ok) throw new Error('Failed to load ' + path);
        return r.json();
      })
      .then(d => setData(d))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [reactionKey]);

  return { data, loading, error, isReal: REAL_DATA_REACTIONS.has(reactionKey) };
}

function useStructures() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('data/structures.json')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}

function useMDTrajectories() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('data/md.json')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}

// Get structure data for a specific reaction
function getStructuresForReaction(structuresData, reactionKey) {
  if (!structuresData) return null;
  const reactions = structuresData.reactions || {};
  const key = STRUCTURE_KEY_MAP[reactionKey];
  if (!key) return null;
  return reactions[key] || null;
}

// Export
Object.assign(window, {
  REACTION_FILES,
  REAL_DATA_REACTIONS,
  STRUCTURE_KEY_MAP,
  useReactionData,
  useStructures,
  useMDTrajectories,
  getStructuresForReaction,
});
