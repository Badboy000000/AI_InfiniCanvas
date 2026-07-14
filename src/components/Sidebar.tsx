import type { LibraryGroup } from '../types';

export function Sidebar({ groups }: { groups: LibraryGroup[] }) {
  return (
    <aside className="sidebar panel">
      <div className="sidebar-header">
        <p className="eyebrow">Node Library</p>
        <h2>节点库</h2>
        <p className="sidebar-copy">从输入、处理、生成到输出，把创作链路像策展一样组织起来。</p>
      </div>
      <div className="sidebar-groups">
        {groups.map((group) => (
          <section key={group.category} className="library-group">
            <div className="library-group-title">{group.category}</div>
            {group.items.map((item) => (
              <article key={item.name} className="library-card">
                <div className="library-card-top">
                  <strong>{item.name}</strong>
                  <span>{item.type}</span>
                </div>
                <p>{item.description}</p>
              </article>
            ))}
          </section>
        ))}
      </div>
    </aside>
  );
}
