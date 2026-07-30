# Citation failure modes

Modes are not mutually exclusive: one entry may exhibit several, and some are
defined by contrast with a neighbour.

---

## Reference-level: what the citation asserts

- **Fabricated reference** — no publication matches the cited combination of title, authors, venue and identifier. Use this when nothing resolves; use *composite reference* when fields from two or more real works are spliced, and *incorrect or incomplete metadata* otherwise.
- **Composite reference** — genuine metadata from different works spliced into one plausible-looking citation. Where the borrowed fragment is an identifier the entry *resolves*, returning a real work with a mismatched title and a partially overlapping author list. Finding one implies the bibliography was assembled by splicing, so the other entries warrant the same scrutiny.
- **Incorrect or incomplete metadata** — wrong or missing authors, title, venue, volume, pages, publisher, DOI or source type.
- **Typographical corruption** — misspelled names or titles requiring fuzzy matching rather than exact lookup.
- **Identifier mismatch** — a valid DOI, URL or repository identifier resolves to a different work.
- **Malformed locator** — a DOI or URL damaged by line wrapping, non-ASCII characters, duplicated schemes or copied browser fragments.
- **Broken or unavailable link** — the supplied location cannot be accessed or was apparently constructed without verification.
- **Version mismatch** — the citation describes the published work but links to a preprint, mirror or repository copy without justification.
- **Wrong date** — confusion among preprint, online-first, issue, revision, retrieval and publication dates.

## Source-level: what the source is

- **Questionable venue** — a predatory or weakly vetted journal or conference used without scrutiny or corroboration.
- **Non-scholarly source presented as scholarship** — marketing material, a forum post, blog or vendor page described as a paper or technical report. The fault is the misdescription of one source; compare *misleading source equivalence*, where nothing is misdescribed but the hierarchy is flattened.
- **Mutable or gated source inadequately documented** — living documentation, market reports or lead-generation pages cited without version, access date or stable evidence.
- **Inappropriate or discredited source** — a retracted, withdrawn or otherwise unsuitable source relied upon without acknowledging the problem. Topical irrelevance belongs under *unsupported claim*: there the source is sound and the pairing is wrong.
- **Insufficient scholarly grounding** — the bibliography depends predominantly on vendors, journalism and general websites where research literature is expected. A property of the list as a whole, established by counting rather than inspection; recurring instances of *non-scholarly source presented as scholarship* do not amount to it.
- **Secondary-only bibliography** — reviews and surveys throughout where primary research is expected. Also a property of the whole list: the aggregate counterpart to *citation chaining*, and distinct from *insufficient scholarly grounding* in concerning primary versus secondary rather than scholarly versus grey.

## Use-level: how the source serves the argument

- **Unsupported claim** — the cited source does not provide evidence for the statement. Includes the topically irrelevant source: real, correctly formatted, resolvable, and about something else.
- **Contradictory citation** — the source explicitly conflicts with the claim attributed to it.
- **Exaggeration or quote-mining** — qualifications, limitations or context removed to strengthen the apparent evidence. The quoted words are real; compare *fabricated quotation*.
- **Fabricated quotation** — words placed in quotation marks appear nowhere in the cited source. Quotation marks assert verbatim reproduction, and the assertion is false.
- **Citation chaining** — an original finding attributed through another author's summary rather than the primary source.
- **Superseded source presented as current** — metadata correct and the claim true when published, but the work has since been overtaken and is offered as the present state of the art.
- **Undifferentiated block citation** — many sources behind one claim, with no indication which supports which part.
- **Descriptive listing without synthesis** — one source per claim, repeated, with no relation drawn between them. The sources are relevant; they are simply not connected to one another.
- **Poor citation integration** — a citation with no identifiable evidential role, bearing on nothing in the surrounding argument. Compare *descriptive listing without synthesis*, where the sources are relevant but unrelated to each other.
- **Lack of critical evaluation** — methods, credibility, limitations, applicability and conflicting findings ignored. Compare *descriptive listing without synthesis*, which concerns the absence of structure rather than of judgement.
- **Patchwriting** — wording or structure reproduced with only superficial paraphrasing.
- **Overreliance on quotation** — quotations substitute for interpretation and synthesis.
- **Missing citation** — a factual, numerical, technical or evaluative claim has no supporting source.
- **Misleading source equivalence** — sources of different standing treated as carrying the same weight, or a lesser source placed above a stronger one. Appears explicitly, as a sentence arguing that vendor evidence outranks peer review, or implicitly, where the prose's register never varies with source type.

## Structural and document-level

- **Duplicate entry** — the same source appears more than once, possibly under different numbers.
- **Orphan reference** — a bibliography entry is never cited in the text.
- **Phantom citation** — an in-text citation has no corresponding bibliography entry.
- **Reference-manager or copy-and-paste debris** — draft notes, duplicated fields, fused labels, malformed author data or browser anchors left in the entry. Normally presents as *incorrect or incomplete metadata* or *malformed locator*; finding it implies a single bad import produced the other entries too.
- **Inconsistent citation system** — numbering, author–date conventions or bibliography styles mixed in ways that impede traceability.
- **Inconsistent in-text attribution** — the prose names different authors for the same reference in different places. Confined to numeric styles: under author–date the attribution is the citation, so a mismatch is visible on the page.

## False-positive guards

- **Extraction artefacts are not student faults** — page headers, footers or broken line wraps may have been introduced by document parsing. An instruction to the extractor rather than the checker, and it cross-cuts: a fused header presents as *incorrect or incomplete metadata*, *typographical corruption*, *malformed locator* or *reference-manager debris* depending on where it lands.
- **Unusual names may be correct** — one-letter surnames, compound surnames, diacritics and consortium authorship require verification, not normalisation.
- **Grey literature may be authoritative** — standards, legislation, official documentation and product specifications can be the correct primary sources for engineering claims.
- **Preprints may be appropriate** — no fault exists when no final version is available, or when the specific preprint version is intentionally discussed.
- **Retracted work may be cited appropriately** — for example, when discussing the retraction, the misconduct or the work's historical influence.
- **Uncommon publication structures may be valid** — article numbers, online-first records, group authors and proceedings without conventional pages are not automatically incomplete.
- **A currently broken link may once have worked** — present inaccessibility does not establish that the original citation was fabricated or useless.
