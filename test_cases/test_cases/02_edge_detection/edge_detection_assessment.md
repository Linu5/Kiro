# Test case 02 — edge detection

## What is wrong with this bibliography, and what is not

**Style:** IEEE numeric · **References:** 20 listed · highest number cited: 21 ·
one listed reference is never cited

This chapter is synthetic. It was written to look like the literature review of a
competent but hurried undergraduate who has used a generative model to produce
fluent prose and a reference manager to produce a bibliography, and has checked
neither carefully. The prose is deliberately polished; the problems are in the
substance.

It was constructed from failure modes observed in nine real capstone and IWSP
bibliographies. Every mode below has been seen in genuine student work.

Wholly fabricated references use invented author names, so that no non-existent
paper is attributed to a real researcher. Where a reference is based on a real
paper, the paper is real and the fault lies in the metadata around it.

---

## Part A — References that are correct

**These three are sound. Flagging them is a failure in itself.** A student told
that seven of twenty references are broken when four are will stop reading the
output by week three, so false positives cost as much as misses.

**[12] Ren, He, Girshick and Sun — Faster R-CNN.** The second author's surname is
*He*. Any rule that treats common English words, pronouns or short tokens as
parsing debris fires here. The reference is impeccable.

**[15] Lin, Goyal, Girshick, He and Dollár — Focal Loss.** Contains *He* again
and the diacritic in *Dollár*. A pipeline that strips accents before matching may
report a mismatch against its own normalised index and blame the student for it.

**[17] NVIDIA TensorRT documentation — the right kind of source.** Vendor
documentation is the primary source for the behaviour of the vendor's own
product, and asking it what precision modes TensorRT supports is exactly what it
is for. Compare **[18]**, a vendor blog carrying a precise effect size, which
*is* a fault. Same source category, opposite verdict: the discriminator is not
what kind of source it is but what it is asked to support.

*The source type is sound. Its locator is not — see Part B.*

---

## Part B — Reference-level faults

### Detectable with no network access at all

Cheap, exact, and they work offline.

| Ref | Fault |
|---|---|
| **[20]** | **Duplicate** of [7], character for character, under a second number. String comparison. |
| **[19]** | **Orphan** — in the list, cited nowhere in the body. Set difference between in-text markers and list entries. |
| **[3]** | Cited **only inside the range "[1]-[8]"** and never individually, so no claim is attributed to it. Not an orphan: a set difference over literal markers will wrongly report it as one unless ranges are expanded first. |
| **[21]** | **Phantom** — cited in §2.5, no entry in the list. The same set difference, the other way round. |
| **[6]** | DOI written with U+2011 **non-breaking hyphens** instead of ASCII. Looks perfect, never resolves. Compare character classes. |
| **[5]**, **[10]** | Journal references with **neither DOI nor URL**. In real bibliographies the fabricated entry is frequently the one with nothing to link to — here [10] is indeed fabricated, but [5] is a *real* paper, so the signal is suggestive rather than decisive. |

### Requiring a metadata lookup

**[3] MobileNets — real paper, fabricated co-authors.** Title, arXiv identifier
and year are correct; "R. Patel" and "S. Nakamura" are not on the paper. The real
list is Howard, Zhu, Chen, Kalenichenko, Wang, Weyand, Andreetto and Adam.
*Title-only matching passes this reference.* [3] appears in the body only within
the range "[1]-[8]", so nothing in the chapter depends on it specifically.

**[8] Distilling the Knowledge in a Neural Network — affiliation as author.**
"G. Brain" is Google Brain. This was the single most common fault across the nine
real bibliographies the test case was built from, appearing variously as
"P. Servicenow", "Gradients, E." and here as "G. Brain".

**[10], [11], [13], [14] and [16] — wholly fabricated.** Five of the twenty
references name work that does not exist. The author names — Rahman, Oyelade and
Venkatesan; Kowalski and Marchetti; Sokolov, Petrova and Volkov; Nakagawa and
Fischer; Kumar and Devi — are invented, so no real researcher is credited with
work that is not theirs.

The evidence differs by entry, and so does the check that finds it:

- **[10]** names *IEEE Transactions on Mobile Computing*, which carries 7,549
  registered DOIs. The paper is not among them. The entry supplies neither DOI
  nor URL, so there is nothing to resolve.
- **[11]** names *Journal of Embedded Computing Systems*, which is not an IEEE
  title and does not exist. Its DOI, `10.1109/JECS.2022.4471903`, uses IEEE's
  real prefix and returns HTTP 404.
- **[13]** names *Pattern Recognition Letters*, which carries 9,736 registered
  DOIs and does not hold this paper either. Its DOI **does** resolve — see below.
- **[14]** names DATE proceedings, which are indexed. No such paper appears.
- **[16]** names a journal that does not exist: the title returns nothing in
  Crossref's journal registry, and its domain `ijarcset.co.in` has no DNS record
  at all. A non-selective journal still has a website — that is how it solicits
  fees. This one has none.

Four of the five fail on a lookup that returns nothing. [13] is the exception,
and the harder case.

**[13] — a DOI that resolves to the wrong work.**
`10.1016/j.patrec.2005.10.010` is live and returns Fawcett's *An introduction to
ROC analysis*, Pattern Recognition Letters, 2006 — not the pruning review named
in the entry. A checker that only tests whether a DOI is live passes it.
Detection requires comparing the **resolved title** against the **cited title**.

**[11] also does double duty in the argument**: it is the chaining intermediary
in T6 and the source of the uncritically adopted claim in T8.

**[5] EfficientNet in the wrong venue.** Real paper, real authors, real journal —
but the volume, number and pages are invented for it. It was published at ICML
2019, not in IEEE TPAMI.

**[7] Preprint mirror with browser debris.** Cited to an ar5iv HTML mirror, venue
(ICLR 2016) omitted, and the URL ends in a dangling `#:~:text=` — an empty
scroll-to-text fragment left behind by a browser's copy-link-to-highlighted-text
function.

**[17] A locator that does not reach the cited material.** The entry names a
section, "TensorRT developer guide: Working with INT8", and supplies the URL
`https://docs.nvidia.com/deeplearning/tensorrt/developer-guide/`. That URL is the
guide root. It resolves to an architecture overview containing no INT8 section,
no calibration mechanics and no heading of that name; the current equivalent in
the navigation is called "Working with Quantized Types".

The access date (14 Mar. 2026) is supplied, which is better practice than most
web citations manage, and it does not help: the URL was never specific enough to
reach the section, and the section has since been renamed. Living documentation
cited at directory level is unciteable in practice — a reader following it lands
somewhere that does not contain the claim.

**[18] Grey literature carrying an effect size.** "Cut inference latency by 63%"
sourced to a vendor blog. Contrast [17].

---

## Part C — Text-level faults

These do not attach to a single reference, and they are where a *coach* earns its
name.

**T5 and T10 — patchwriting.** Two passages closely track the wording and
structure of a source without quoting or citing it: the framing of detection as
regression in §2.2, and the description of INT8 calibration in §2.4. Neither is
plagiarism in the crude sense and neither would trip a similarity checker at
these lengths.

*T10 is recorded as unverified. The page [17] actually points to contains no
calibration description, so the passage cannot be compared against the source as
cited; whether it tracks NVIDIA's wording elsewhere has not been established.*

**T7 — a source cited for a claim it contradicts.** §2.5 cites [9] for accuracy
transferring reliably after quantisation, then contradicts itself in the very
next sentence. The internal contradiction is detectable from the text alone; the
misattribution needs the source.

**T4 — quote-mining.** The quoted fragment from [8] is accurate. The gloss
attached to it is not.

**T3 and T11 — numbers.** An invented "87%" attached to a correct reference, and
an uncited "approximately 40%". Precise figures with no traceable origin are the
highest-value target in the whole chapter, because they are what a marker checks
first.

**T1 — block citation.** "[1]-[8]" supporting one unattributable generality.

**T2 — chronology without synthesis.** §2.2 lists accuracy figures from different
benchmarks, metrics and years in sequence, as though they were comparable.

**T6 — citation chaining.** A primary result reached through an intermediary
([11]) rather than through the source itself.

**T8 — a contested claim adopted uncritically.** "Quantisation is universally
preferable" is taken from [11] as a working assumption.

**T9 — dropped-in citations.** Three consecutive sentences of the form "X did Y",
related to nothing.

**T12 — a promise never kept.** §2.4 says a source's work "is described in detail
in the following paragraphs". The section ends immediately afterwards.

---

## Part D — What is deliberately absent

Two catalogued modes are **not** instantiated here and are available for a
further test case: a retracted or withdrawn source, and a topically irrelevant
source. Also absent by design: any fault requiring a subscription to detect.

## Provenance

Built from failure modes observed in nine anonymised capstone and IWSP
bibliographies across ICT programmes. Real sources cited in this chapter were
verified against Crossref, the ACL Anthology, IEEE Xplore, CVF Open Access and
publisher records in July 2026. The DOI, orphan, phantom, duplicate, hyphen and
authorship claims above were re-checked against Crossref and the arXiv API on
29 July 2026.
