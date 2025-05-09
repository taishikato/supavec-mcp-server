import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

type EMBEDDINGS = {
  documents: {
    content: string;
  }[];
};

const server = new Server(
  {
    name: "supavec",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const SUPAVEC_BASE_URL = "https://api.supavec.com";
const apiKey = process.env.SUPAVEC_API_KEY || "";

async function makeSupavecRequest<T>(
  url: string,
  body: object
): Promise<T | { error: string }> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      return {
        error: `Failed to fetch data: status ${response.status}`,
      };
    }

    const data = await response.json();
    return data as T;
  } catch (error) {
    return {
      error: `Failed to fetch data: ${error}`,
    };
  }
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "fetch-embeddings",
        description: "Fetch embeddings for a file by ID and query",
        inputSchema: {
          type: "object",
          properties: {
            file_id: {
              type: "string",
              description: "ID of the file to get embeddings for",
            },
            query: {
              type: "string",
              description: "Query to search for in the file",
            },
          },
          required: ["file_id", "query"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "fetch-embeddings") {
    const file_id = request.params.arguments?.file_id as string;
    const query = request.params.arguments?.query as string;
    const embeddingsUrl = `${SUPAVEC_BASE_URL}/embeddings`;
    const embeddings = await makeSupavecRequest<EMBEDDINGS>(embeddingsUrl, {
      file_ids: [file_id],
      query: query,
    });

    if ("error" in embeddings) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to retrieve embeddings for ${file_id}: ${embeddings.error}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          mimeType: "application/json",
          text: JSON.stringify(
            embeddings.documents.map((d) => d.content).join("\n"),
            null,
            2
          ),
        },
      ],
    };
  }

  throw new Error("Tool not found");
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
