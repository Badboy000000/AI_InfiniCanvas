export function TopBar() {
  return (
    <header className="topbar panel">
      <div>
        <p className="eyebrow">AI Creative Workflow Canvas</p>
        <h1>无限创作画布原型</h1>
      </div>
      <div className="topbar-meta">
        <div className="meta-pill">Prototype / Frontend Only</div>
        <div className="meta-pill soft">Spring Campaign Flow</div>
        <button className="ghost-button">保存草稿</button>
        <button className="primary-button">运行工作流</button>
      </div>
    </header>
  );
}
