package output

import (
	"encoding/json"
	"io"

	"github.com/Ender-Wang/ShipLens/packages/cli/internal/core"
)

// JSON writes a JSON object describing `result` to `w`. Output schema is
// stable: callers (CI scripts, agents) can rely on field names. Unset fields
// are omitted (omitempty in core.LineReleaseResult).
//
// A trailing newline is written so the output is friendly to `jq` and pipes.
func JSON(w io.Writer, result core.LineReleaseResult) error {
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	enc.SetEscapeHTML(false)
	return enc.Encode(result)
}
