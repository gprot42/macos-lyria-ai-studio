export default function App() {
  return (
    <div style={{ padding: "20px", background: "#1a1b26", color: "white", minHeight: "100vh" }}>
      <h1>Lyria AI Studio</h1>
      <p>If you see this, React is working!</p>
      <p>Theme attribute: {document.documentElement.getAttribute("data-theme")}</p>
    </div>
  )
}
