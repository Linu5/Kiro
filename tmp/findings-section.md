## 3. Citation integrity findings

10 findings: 4 critical, 3 major, 2 moderate. 10 are established from the document or a registry record; 0 need evidence from the student. 6 of 12 references carry no finding.

| Severity | Failure mode | Ref | Finding | Status |
| --- | --- | --- | --- | --- |
| critical | Duplicate entry | [11], [3] | [11] duplicates [3] | confirmed |
| critical | Fabricated reference | [9] | The DOI is well formed but resolves to nothing | confirmed |
| critical | Identifier mismatch | [10] | The DOI resolves to a different work | confirmed |
| critical | Incorrect or incomplete metadata | [10] | None of the listed authors appear on the work this identifier returns | confirmed |
| major | Incorrect or incomplete metadata | [12] | Author list is incomplete: 2 listed, 6 on the record | confirmed |
| major | Phantom citation | [13] | [13] is cited in the text but has no bibliography entry | confirmed |
| major | Wrong date | [4] | Entry dated 2016, but its own DOI encodes 2018 | confirmed |
| moderate | Orphan reference | [7] | [7] appears in the bibliography but is never cited | confirmed |
| moderate | Wrong date | [10] | The registry records 2015, the entry says 2019 | confirmed |
| advisory | Inconsistent citation system | [1], [3], [6], [2], [4] | Reference numbers do not follow the order of first citation | confirmed |

**Duplicate entry - [11], [3].** [11] and [3] share the same DOI (10.1109/ACCESS.2019.2902718) with altered metadata. Two numbers for one source let the prose present a single study as independent corroboration.

> Question to answer: Are [3] and [11] the same study? If so, does any sentence treat them as two?

**Fabricated reference - [9].** 10.9999/jaus.2021.04117 uses a real registrant prefix, so it passes format validation, yet neither Crossref nor OpenAlex holds it. A DOI that looks right and resolves to nothing is the signature of a fabricated reference. Any figure attributed to [9] has no traceable source.

> Question to answer: Show where you obtained [9]. Can you open the source and point to the passage you used?

**Identifier mismatch - [10].** 10.1038/nature14539 is live, but it returns "Deep learning" (2015), not "Piezoresistive insole arrays for real-time fall-risk scoring in home-based elderly monitoring". Testing whether a DOI resolves is not enough; the resolved title has to match the cited one.

> Question to answer: Which work did you actually read for [10] - the one you titled, or the one this DOI returns?

**Incorrect or incomplete metadata - [10].** Registry authors for 10.1038/nature14539: Yann LeCun; Yoshua Bengio; Geoffrey Hinton. The entry lists: B. Osei; R. Whitfield. Title-only matching passes this reference, which is why the author list has to be compared too.

> Question to answer: Where did the author names in [10] come from? They are not the authors of the work the identifier returns.

> Restraint: Comparison folds diacritics and accepts particle and single-syllable surnames, so "OndÅ™ej", "van Beek" and "He" do not trigger it.

**Incorrect or incomplete metadata - [12].** The record for 10.1016/j.measen.2025.101870 names Ch Gangadhar; P Pavithra Roy; R. Dinesh Kumar; Janjhyam Venkata Naga Ramesh; S. Ravikanth; N. Akhila. The entry omits 4 of them without "et al.".

> Question to answer: Should [12] credit every author, or be shortened with "et al."?

**Phantom citation - [13].** The list ends at [12]. [13] is cited on page 1 and points at nothing, so whatever it supports has no source at all.

> Question to answer: What source is [13]? Add the entry, or remove the claim that leans on it.

**Wrong date - [4].** The DOI 10.1109/JSEN.2018.2872835 carries 2018 in its suffix while the entry states 2016. No lookup is needed to see the contradiction; one of the two is wrong.

> Question to answer: Which year is right for [4], and did you take the date from the record or from another citation of it?

**Orphan reference - [7].** Set difference between in-text markers and list entries leaves [7] uncited: "A low power fall sensing technology based on fd-cnn". Either it informed the chapter and should be cited, or it should be removed.

> Question to answer: Did you use [7]? If so, which sentence should carry it?

**Wrong date - [10].** Registry record for 10.1038/nature14539: 2015. Entry: 2019. Preprint, online-first and issue dates are commonly confused.

**Inconsistent citation system - [1], [3], [6], [2], [4].** First-citation order begins 8, 1, 5, 3, 12, 6, 2, 9, 13, 4. Under IEEE and Vancouver numbering, entry [1] is the first source cited, [2] the second, and so on, which lets a reader move between text and list without searching. 5 marker(s) appear after a higher-numbered one.

> Question to answer: Does your programme require numbering in citation order? If so, renumber the list.

> Restraint: Advisory only: ordering is a presentation convention and says nothing about whether any cited source is sound.


