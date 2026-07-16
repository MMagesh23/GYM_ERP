let appStore;

export const setStore = (store) => {
  appStore = store;
};

export const getStore = () => {
  if (!appStore) {
    throw new Error('Redux store has not been initialized yet.');
  }

  return appStore;
};
