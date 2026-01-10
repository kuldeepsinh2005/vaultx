// frontend/src/utils/buildTree.js
export function buildFolderTree(folders) {
  const map = {};
  const roots = [];

  folders.forEach(f => (map[f._id] = { ...f, children: [] }));

  folders.forEach(f => {
    if (f.parent) {
      map[f.parent]?.children.push(map[f._id]);
    } else {
      roots.push(map[f._id]);
    }
  });

  return roots;
}
