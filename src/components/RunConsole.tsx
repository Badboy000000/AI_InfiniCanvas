export function RunConsole({ events }: { events: Array<{ time: string; state: string; text: string }> }) {
  return (
    <section className="run-console panel">
      <div className="run-console-header">
        <div>
          <p className="eyebrow">Runtime Feed</p>
          <h2>运行反馈区</h2>
        </div>
        <div className="console-summary">结构合法 · 1 个节点运行中 · 1 个节点待执行</div>
      </div>
      <div className="console-list">
        {events.map((event) => (
          <article key={`${event.time}-${event.text}`} className="console-item">
            <span>{event.time}</span>
            <strong>{event.state}</strong>
            <p>{event.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
