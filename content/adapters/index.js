window.GuitarPlayMode = window.GuitarPlayMode || {};

window.GuitarPlayMode.getAdapter = function() {
  const adapters = [
    new window.GuitarPlayMode.CifraclubAdapter(),
    new window.GuitarPlayMode.UltimateGuitarAdapter()
  ];
  return adapters.find(adapter => adapter.detect());
};
