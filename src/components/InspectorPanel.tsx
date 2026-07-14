import type { InspectorSection, WorkflowNode } from '../types';

export function InspectorPanel({ node, sections }: { node: WorkflowNode; sections: InspectorSection[] }) {
  return (
    <aside className="inspector panel">
      <div className="inspector-header">
        <p className="eyebrow">Inspector</p>
        <h2>{node.title}</h2>
        <p>{node.description}</p>
      </div>
      <div className="inspector-hero">
        <span>{node.category}</span>
        <strong>{node.type}</strong>
        <em>{node.status}</em>
      </div>
      {sections.map((section) => (
        <section key={section.title} className="inspector-section">
          <h3>{section.title}</h3>
          <ul>
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
    </aside>
  );
}
