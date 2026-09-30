export const CATEGORIAS = [
  { id: 'comida', label: 'Comida', icon: 'fast-food-outline' },
  { id: 'transporte', label: 'Transporte', icon: 'bus-outline' },
  { id: 'entretenimiento', label: 'Entretenimiento', icon: 'game-controller-outline' },
  { id: 'salud', label: 'Salud', icon: 'medkit-outline' },
  { id: 'servicios', label: 'Servicios', icon: 'flash-outline' },
  { id: 'otros', label: 'Otros', icon: 'ellipsis-horizontal-outline' },
];

export const getCategoria = (id) =>
  CATEGORIAS.find((c) => c.id === id) || CATEGORIAS[CATEGORIAS.length - 1];