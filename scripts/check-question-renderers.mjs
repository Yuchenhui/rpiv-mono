// Dependency-free smoke test: execute the actual renderer bodies, not a duplicate.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(
	new URL("../packages/rpiv-ask-user-question/ask-user-question.ts", import.meta.url),
	"utf8",
);
const start = source.indexOf("\t\trenderCall(");
const end = source.indexOf("\n\t\tasync execute(", start);
assert.ok(start >= 0 && end > start, "Renderer definitions must exist");
const bodies = source
	.slice(start, end)
	.replace("(args as QuestionParams)", "args")
	.replace("result.details as QuestionnaireResult | undefined", "result.details");
class Text {
	constructor(text) {
		this.text = text;
	}
}
const renderers = vm.runInNewContext(`({${bodies}})`, { Text });
const theme = { fg: (color, text) => `<${color}>${text}</${color}>` };
const call = (questions) => renderers.renderCall({ questions }, theme, {}).text;
const result = (details) => renderers.renderResult({ details }, {}, theme, {}).text;
assert.equal(call([{ question: "One" }, { question: "Two" }]), "");
assert.equal(call([{ question: "One" }]), "<accent>Q: One</accent>");
assert.equal(
	result({
		answers: [
			{ question: "One", answer: "Alpha", kind: "single" },
			{ question: "Two", kind: "multi", selected: ["Beta", "Custom answer"] },
			{ question: "Three", answer: "Gamma", kind: "single" },
		],
	}),
	"<accent>Q1: One</accent>\nA1: Alpha\n\n<accent>Q2: Two</accent>\nA2: 1. Beta\n    2. Custom answer\n\n<accent>Q3: Three</accent>\nA3: Gamma",
);
// Single-question: renderCall already printed the Q: line — the result block
// must carry only the answer, otherwise the question appears twice.
assert.equal(result({ answers: [{ question: "One", answer: "Alpha" }] }), "A: Alpha");
assert.equal(
	result({ answers: [{ question: "One", kind: "multi", selected: ["Beta", "Custom answer"] }] }),
	"A: 1. Beta\n   2. Custom answer",
);
assert.equal(result({ cancelled: true }), "<muted>✗ 已取消</muted>");
assert.equal(result(undefined), "<muted>✗ 已取消</muted>");
console.log("Question renderer smoke tests passed (highlight, ordering, multi-select, single, cancellation).");
