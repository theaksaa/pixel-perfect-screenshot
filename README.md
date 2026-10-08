# Pixel Perfect Screenshot

Implement exactly the screenshot and nothing else

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8bc6cde9-bbfe-4404-b94a-1eb7ee17bd34).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Importing Code Atlas projects

Use **Import JSON** to upload a `.json` file or paste JSON, then choose **Load Project**. **Load Example** restores the built-in demo, and **Download example JSON** provides a complete sample. Valid imports are saved in this browser's local storage. No backend is required. The assistant currently produces local, model-based answers rather than calling an AI service.

The project format is:

```json
{
  "project": { "id": "my-project", "name": "My Project", "description": "Optional summary" },
  "nodes": [
    { "id": "service", "name": "My Service", "type": "service" },
    { "id": "handler", "name": "handle", "type": "method", "parent": "service", "file": "src/Handler.java" }
  ],
  "relationships": [
    { "source": "service", "target": "handler", "type": "CALLS", "view": "code" }
  ],
  "documentation": { "handler": "# handle()\n\nHandles requests in [[service]]." }
}
```

`project.id`, `project.name`, `nodes`, and `relationships` are required. Node IDs must be unique, including the root project ID. A node needs `id`, `name`, and `type`; absent `parent` means the root project. Parents and relationship endpoints must exist, and parent cycles are rejected. Relationships need `source`, `target`, and `type`. Documentation values must be Markdown strings keyed by existing entity IDs.

Nodes accept optional `description`, `domain`, `stack`, `stats`, `repo`, `file`, and `position: { "x": 440, "y": 210 }`. Root architecture views preserve provided positions when every displayed node has one; other views use hierarchical layout. The example preserves the original Architecture Graph through these positions.

Use `view: "architecture"` or `view: "code"` to assign relationships explicitly. Without `view`, REST, HTTP, KAFKA, GRPC, SQL, and DATA links between architecture node types become architecture relationships; other links become code relationships. This only classifies declared relationships and does not create new ones. Unknown node and relationship types remain supported with neutral styling. Top-level architecture entities include `gateway`, `service`, `database`, `broker`, `topic`, `kafka-topic`, and `external`.

Code relationships include CALLS, USES, IMPLEMENTS, EXTENDS, CREATES, READS, WRITES, PRODUCES, CONSUMES, HTTP_CALL, GRPC_CALL, and DEPENDS_ON. Arrow direction follows `source` → `target`, including CONSUMES. Parent containment controls breadcrumbs and graph scope but does not create execution edges. A service/class code view includes descendants and immediate connected entities; a method view includes two levels of callers and callees, explored separately.

Documentation supports headings, paragraphs, lists, fenced code, bold text, Markdown links, `[[node-id]]`, and `[[node-id|label]]`. Inline code matching an entity name or `Class.method()` becomes a navigation link. Graphs, documentation, search, breadcrumbs, and assistant context all use the imported model.
