# Test case 01 — evacuation simulation

## What is wrong with this bibliography, and what is not

**Style:** deliberately inconsistent — author–date and numeric interleaved ·
**References:** 18 listed, 19 cited · one listed reference is never cited

This chapter is synthetic. It was written to look like the work of a student who
assembled a plausible bibliography quickly and checked very little of it. Six of
its eighteen references are entirely sound, and three of those six are
constructed to look wrong to a careless checker.

Modes named in parentheses are those of `../FAILURE_MODES.md`.

---

## Part A — References that are correct

**Flagging any of these is a failure.** Three are ordinary; three are traps.

**[1] Helbing & Molnár** and **[2] Treuille, Cooper & Popović** are real and
correctly attributed. Nothing about the entries is difficult.

Note the distinction this section draws: a **reference** can be sound while a
**use** of it is not. Both are cited accurately in their own right — [1] for the
social force model, [2] for continuum scaling — and both are also swept into the
block citation of U1 and the chronology of U4. The faults there belong to those
sentences, not to these entries. A tool that flags [1] because of the company it
keeps in "[1]–[6]" has made the error this section exists to catch.

**[15] Ondřej, Pettré, Olivier & Donikian — SIGGRAPH 2010.** *(guard: unusual names may be correct)* Two
diacritics in the author list, one a caron that many normalisation routines do
not round-trip. A pipeline that strips accents before matching will mismatch
against its own index and report an author error that does not exist. The DOI
`10.1145/1833349.1778860` resolves and the entry is impeccable.

**[16] Karamouzas, Heil, van Beek & Overmars — *Motion in Games* 2009.**
*(guard: unusual names may be correct)* "van Beek" is a particle surname. Parsers that title-case, split on
spaces or treat lowercase tokens as debris will corrupt it. The entry is
correct, including the LNCS page range.

**[18] NFPA 130.** *(guards: grey literature may be authoritative; uncommon publication structures may be valid)* No DOI, no page numbers, no named author,
no year — and entirely correct. A published standard is the primary source for
egress timing requirements, and it is cited for exactly what it specifies. A
checker that demands a DOI, or that ranks grey literature as inferior by
category, fails this reference. Compare **[8]**, a vendor blog carrying an
effect size, which *is* a fault. Same category, opposite verdict: the question
is not what kind of source it is but what it is asked to support.

---

## Part B — Reference-level faults

### Detectable with no network access

| Ref | Fault | Mode |
|:--|:--|:--|
| **[12]** | Orphan — listed, cited nowhere | Orphan reference |
| **[19]** | Phantom — cited in §"Current Approaches"; the list ends at [18] | Phantom citation |
| **[10]** | Dated 2015; its own DOI suffix says 2013 | Wrong date |
| **[7]** | No arXiv identifier, no URL — cannot be located even in principle | Incorrect or incomplete metadata |
| — | Author–date and numeric styles interleaved throughout | Inconsistent citation system |

### Requiring a metadata lookup

**[4] Invented authors on a genuine paper.** *(incorrect or incomplete metadata)* Title and DOI
`10.1145/37401.37406` are real and resolve; "Marchetti, Osei and Rahman" are
not. The work is Craig W. Reynolds, sole author, SIGGRAPH 1987. Title-only
matching passes this reference.

**[5] Wholly fabricated.** *(fabricated reference; broken or unavailable link)* `10.1109/TVCG.2023.3298871` is well-formed,
carries IEEE's real prefix, and resolves to nothing. The 4.2× figure quoted from
it is invented.

**[6] Venue does not exist.** *(questionable venue)* *International Journal of Advanced
Computational Intelligence and Simulation Research* has no ISSN and no indexing.
§"Problem Statement" uses it to establish the central consensus of the field —
the most load-bearing claim resting on the least verifiable source.

**[10] What the lookup adds.** The year contradiction is in the table above and
needs no network. Resolving `10.1016/j.trc.2013.02.005` does two further things:
it confirms 2013 against the entry's 2015, and it establishes that Duives,
Daamen and Hoogendoorn's *State-of-the-art crowd motion simulation models* is a
**review**. U9 depends on that — a survey cannot be the source of the primary
figure attributed to it. The entry fails twice more in use; see U6 and U9.

**[11] Unverifiable.** *(broken or unavailable link; mutable or gated source inadequately documented)* No publisher, no venue, no DOI; the URL is a
PHP download script on an unidentifiable mirror.

**[13] and [14] — the wrong copy.** *(version mismatch)* Both cite genuine, peer-reviewed work
without citing the published version. [13] is Social GAN, CVPR 2018, DOI
`10.1109/CVPR.2018.00240`; [14] is Social LSTM, CVPR 2016, DOI
`10.1109/CVPR.2016.110`, reached here through a ResearchGate page with no year
and no venue.

---

## Part C — Use-level faults

Where the coach earns its name. Every reference below is either sound or already
accounted for above; the fault is in what is claimed of it.

**U1 — Block citation.** *(undifferentiated block citation)* §"Project Overview"
supports "the field is mature and the foundations are settled" with "[1]–[6]".
Six heterogeneous sources, no part of the claim traceable to any one of them —
and the block conceals how weak its own membership is. **[5] and [6] do not
exist**: the first has a DOI that returns 404, the second a venue with no ISSN
and no indexing. **[4] carries an invented author list.** Only [1], [2] and [3]
name real work correctly, and [3] is misused elsewhere. Half the support for a
claim about the maturity of the field is imaginary, and the block is what hides
that.

**U2 — Uncited statistic.** *(missing citation)* "Around 70% of facilities managers report
that their current drill programme is inadequate" carries no citation at all, in
a paragraph otherwise dense with them.

**U3 — The claim contradicts the source.** *(contradictory citation)* §"Agent Behaviour Models"
attributes to [3] the finding that widening exits "consistently reduces total
evacuation time". The paper does not report that. Its subject is panic dynamics
and jamming; its central result is that escape efficiency is *not* monotonic in
desired velocity — faster-is-slower — and it concludes that an optimal escape
strategy mixes individualistic and collective behaviour. Exit width is not the
variable it settles.

The chapter then makes exit width "the primary design variable exposed to the
trainee" on the strength of that misreading. Correcting the citation reopens a
design decision.

**U4 — Chronology in place of synthesis.** *(descriptive listing without synthesis)* The paragraph beginning "The
subsequent development of the field can be summarised chronologically" lists
seven works by year and concludes that "each of these represents a refinement of
its predecessor". They are not one lineage: continuum methods, velocity
obstacles and synthetic vision are alternative formulations, not successive
improvements. Nothing is compared and no criterion of refinement is offered.

**U5 — Overreliance on quotation.** §"Perception and Steering" is built almost
entirely from quoted fragments of [15] and [16] strung together. No synthesis is
attempted, and the section closes by admitting that the question it raised "is
not addressed in the sources" — having given no reason to prefer either method.
Three quotations do the work that the student's own comparison should have done.

**U13 — Quotation that cannot be located.** *(fabricated quotation)* Those same
three fragments — "based on a synthetic vision model", "a way to avoid
collisions" and "smooth and natural trajectories" — cannot be traced. Both
sources are paywalled, no open-access copy of either is indexed, and the
abstract of [15] contains neither of the two phrases attributed to it.

Neither quotation can be confirmed or refuted from outside a subscription, so
the fault is recorded as unverifiable rather than as fabricated.

**U6 — Dropped-in and irrelevant citations.** *(poor citation integration; inappropriate or discredited source; missing citation)* Three consecutive
sentences of the form "X did Y", related to nothing around them and to a
different field entirely:

> Rahman et al. examined energy-aware scheduling of detection workloads across
> heterogeneous embedded processors [10]. Sokolov and colleagues reviewed
> structured pruning. Nakagawa proposed an adaptive precision scheme.

Three faults compound. The named author does not match the entry — **[10] is
Duives, Daamen and Hoogendoorn's crowd-motion survey**, not Rahman. Nor does the
subject: energy-aware scheduling on embedded processors is not what that survey
is about, and has no bearing on crowd simulation. And the second and third
sentences carry no citation at all.

**U7 — Patchwriting.** The paragraph beginning "A practical system will
therefore combine several techniques in sequence" tracks the structure and
phrasing of [17]'s account of aggregate dynamics — partition by density, retain
individuals where density is low, integrate forward, coarsen the remainder —
without quotation and without citation at the point of borrowing.

**U8 — Superseded source presented as current.** §"Current Approaches" calls reciprocal velocity obstacles "the current
state of the art". [9] is from 2008. ORCA and other successors in that lineage
postdate it, and so do the alternative formulations this chapter cites itself at
[17] (2009) and [15] (2010) — neither of which descends from reciprocal velocity
obstacles, but both of which are later work on the same problem. The metadata is
correct, the source is sound, and the claim is still wrong.

**U9 — Secondary source for a primary result.** *(citation chaining)* "A 34 %
reduction in simulated egress time" is attributed to [10], which is a review of
crowd motion simulation models — a fact establishable from its title and record
without reading it.

The fault is in the form of the citation, not in the contents of the source. A
review synthesises primary results; it does not produce experimental findings.
So either the figure is in [10], in which case it belongs to a primary study
that should have been cited instead, or it is not, in which case it has no
source at all. The student cited the wrong kind of thing either way, and a coach
can establish that without access to the paper.

*(The paper is paywalled and no open-access copy is indexed. Whether the figure
in fact appears in it has not been checked, and the fault above does not depend
on it.)*

**U10 — Preprint described as peer-reviewed.** *(misleading source equivalence)* §"Validation" says "a
peer-reviewed study of transformer-based trajectory forecasting reports…". The
entry says arXiv.

**U11 — Vendor material carrying an effect size.** *(non-scholarly source presented as scholarship)* The 60 fps / 10,000
agents figure is sourced to a vendor's promotional blog, with no access date and
a URL pointing at the blog root. The chapter then infers that "the rendering
side of the problem is largely solved", which the source would not support even
if the figure were independently verified.

**U12 — No critical evaluation anywhere.** *(lack of critical evaluation)* §"Summary" asserts that "every
component required has been demonstrated separately and validated in its own
right, so the remaining work is integration rather than investigation". No
limitation is attributed to any cited work, no two sources are compared on any
dimension, and the single acknowledged risk is immediately set aside.

---

## Expected verification outcomes

| Ref | Lookup | Reading the source |
|:--|:--|:--|
| [1] [2] [15] [16] [17] [18] | pass | pass |
| [3] | pass | **fail — claim contradicted** |
| [4] | **fail — authors** | n/a |
| [5] | **fail — unresolved** | n/a |
| [6] | **fail — venue** | n/a |
| [7] | **fail — no identifier** | **fail — called peer-reviewed** |
| [8] | pass | **fail — source type** |
| [9] | pass | **fail — presented as current** |
| [10] | **fail — year** | **fail — survey for primary** |
| [11] | **fail — no identifier** | **fail — no checkable claim** |
| [12] | pass | n/a — never cited |
| [13] [14] | **fail — version of record exists** | n/a |
| [19] | **fail — no such reference** | n/a |

**Six of eighteen references are sound, three of them deliberately awkward.** A
lookup-only prototype finds eight of the twelve faulty entries, returns [3], [8]
and [9] clean, and finds none of U1 through U13.

---

## Provenance

The three quoted fragments in §"Perception and Steering" have not been verified
against their sources, which are paywalled; see U13.

Real metadata verified against the Crossref and arXiv APIs on 29 July 2026:
[1], [2], [3], [4] (as Reynolds), [9], [13] (as CVPR 2018), [14] (as CVPR 2016),
[10], [15], [16] and [17] all resolve as described; [10]'s record gives 2013
against the 2015 in the entry. The fabricated DOI in [5] was confirmed to return
HTTP 404 on the same date. The characterisation of
[3]'s findings follows the abstract of arXiv:cond-mat/0009448.
