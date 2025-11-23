import { useEffect, useMemo, useState } from "react";
import NetworkGraph from "./components/NetworkGraph";
import { fetchElectionGraph, searchElectionEntities, type SearchResult } from "./api";
import type { ElectionNode, ElectionEdge } from "./types";

function App() {
  const [nodes, setNodes] = useState<ElectionNode[]>([]);
  const [links, setLinks] = useState<ElectionEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const loadGraph = async () => {
      try {
        setLoading(true);
        const data = await fetchElectionGraph(150);
        setNodes(data.nodes);
        setLinks(data.links);
      } catch (error) {
        console.error("Error loading graph:", error);
      } finally {
        setLoading(false);
      }
    };
    loadGraph();
  }, []);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const handle = setTimeout(async () => {
      try {
        setSearching(true);
        const results = await searchElectionEntities(searchQuery);
        setSearchResults(results);
      } catch (error) {
        console.error("Search failed:", error);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 200);

    return () => clearTimeout(handle);
  }, [searchQuery]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId],
  );

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <aside className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-xl font-bold text-blue-400">Election Money Explorer</h1>
          <p className="text-sm text-gray-300 mt-1">
            See which donors, PACs, and companies fund which candidates.
          </p>
        </div>

        <div className="p-4 border-b border-gray-700">
          <label className="block text-sm text-gray-400 mb-2">Search entities</label>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Start typing a name..."
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm focus:outline-none focus:border-blue-500"
          />
          {searchQuery.trim().length >= 2 && (
            <div className="mt-2 bg-gray-700 border border-gray-600 rounded-lg max-h-64 overflow-y-auto">
              {searching ? (
                <div className="px-3 py-2 text-sm text-gray-400">Searching...</div>
              ) : searchResults.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-400">No matches</div>
              ) : (
                searchResults.map((result) => (
                  <button
                    key={result.id}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-600 transition-colors"
                    onClick={() => {
                      setSelectedNodeId(result.id);
                      setSearchQuery("");
                      setSearchResults([]);
                    }}
                  >
                    <div className="font-medium">{result.name}</div>
                    <div className="text-xs text-gray-400">
                      {result.type ? result.type : "unknown"}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-b border-gray-700">
          <div className="flex justify-between text-sm text-gray-400">
            <span>Nodes</span>
            <span className="text-white">{nodes.length.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-400 mt-1">
            <span>Links</span>
            <span className="text-white">{links.length.toLocaleString()}</span>
          </div>
        </div>

        {selectedNode && (
          <div className="p-4 space-y-2">
            <div className="text-xs text-gray-400 uppercase">Selected</div>
            <div className="text-lg font-semibold">{selectedNode.name}</div>
            <div className="text-sm text-gray-300">Type: {selectedNode.type || "unknown"}</div>
            <div className="text-sm text-gray-300">
              In: ${selectedNode.total_in?.toLocaleString() ?? "0"}
            </div>
            <div className="text-sm text-gray-300">
              Out: ${selectedNode.total_out?.toLocaleString() ?? "0"}
            </div>
            <button
              className="mt-2 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm hover:bg-gray-600 transition-colors"
              onClick={() => setSelectedNodeId(null)}
            >
              Clear selection
            </button>
          </div>
        )}
      </aside>

      <main className="flex-1 relative">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4" />
              <p className="text-gray-400">Loading network data...</p>
            </div>
          </div>
        ) : (
          <NetworkGraph
            nodes={nodes}
            links={links}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
          />
        )}
      </main>
    </div>
  );
}

export default App;
