# english
useful tools for self-preparation for C1 Advanced exam (CAE)

## Books and tests

`js/books.js` lists the books of the library and the test numbers in each one.
The files of a test live in `content/<book id>/test<number>/`:
`rue.json` + `rue_key.json` (Reading and Use of English), `wri.json` (Writing),
`lis.json` + `lis_key.json` (Listening). On the page of a test, a paper opens
once its file is there; until then its card says "Coming soon".

## Adding a Writing paper

The Writing player (`writing.html`) reads `content/<book>/test<N>/wri.json`.
The Writing card on the test page opens by itself once that file exists.
`content/sample/test1/wri.json` is a working example with tasks written for this
site: open `writing.html?book=sample&test=1` to see it.

```json
{
  "parts": {
    "1": { "questions": [ { "n": 1, "task": [ ... ] } ] },
    "2": { "questions": [ { "n": 2, "task": [ ... ] }, { "n": 3, "task": [ ... ] }, { "n": 4, "task": [ ... ] } ] }
  }
}
```

A `task` is a list of blocks, shown top to bottom in the left pane:

| Block | Shown as |
| --- | --- |
| `"Some text"` | a paragraph |
| `""` | an empty line |
| `{ "center": "Some text" }` | a centred paragraph |
| `{ "box": [ ...blocks... ] }` | a framed box (notes, an announcement, part of a letter) |

Inside any text: `[[bold]]…[[/bold]]`, `[[underline]]…[[/underline]]`,
`[[italic]]…[[/italic]]`, and `\n` for a line break.

Optional: `"words": { "min": 220, "max": 260 }` at the top level, and `"title"` /
`"instr"` inside a part to replace the standard rubric.
