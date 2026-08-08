export interface LeafOption {
  id: string;
  name: string;
  url: string;
}

export const LEAF_OPTIONS: LeafOption[] = [
  { id: 'leaf-01', name: 'Original', url: '/visuals/tree/leaf-01.png' },
  { id: 'leaf-02', name: 'Maple', url: '/visuals/tree/leaf-02.png' },
];

export const LEAF_STORAGE_KEY = 'valuable-tree-leaf';

export interface LeafPickerProps {
  selectedAsset: string;
  onSelect: (asset: string) => void;
  onClose: () => void;
}
