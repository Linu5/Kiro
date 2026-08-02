# Citation Reasoning Trace Log

| Field | Value |
| --- | --- |
| Report | 2. Related Work |
| File | blind_test_fall_detection.docx (2 pages, 927 words) |
| Supervision checkpoint | Blind benchmark 04_fall_detection · 2026-08-01 |
| Exported | 01/08/2026, 5:50:56 pm |
| Coach version | 0.1.0 |
| Reasoning engine | deterministic heuristics (no model was running) |

> Generated on the student's device. Report text was never transmitted; only citation
> metadata (DOI/title) was sent to Crossref/OpenAlex for source verification.

## 1. Report thesis

> Wearable inertial sensors remain the dominant modality for ambulatory fall detection, owing to their low cost and continuous availability during activities of daily living.

<details><summary>Extracted executive summary</summary>

Wearable inertial sensors remain the dominant modality for ambulatory fall detection, owing to their low cost and continuous availability during activities of daily living. Threshold-based accelerometer systems worn at the waist can achieve high sensitivity for high-impact falls, but early implementations suffered elevated false-alarm rates during vigorous non-fall activities such as sitting down quickly [8]. Device-free alternatives have also been explored: Tian et al. showed that a convolutional network applied to RF reflection patterns could detect a fall without requiring the subject to wear any device at all [1], while vision-based systems analysing the motion and shape of the human body over a video stream have reported comparable accuracy in controlled indoor settings, at the cost of requiring fixed camera infrastructure [5].

Machine learning approaches applied to wearable-sensor data have moved from simple threshold rules toward learned classifiers capable of distinguishing between fall subtypes rather than treating a fall as a single event class. Kwon et al. proposed an energy-efficient classification scheme that distinguishes forward, backward and lateral falls on a resource-constrained wearable platform [3], and the same forward/backward/lateral distinction was later reused as a benchmark task in a broader comparison of ensemble methods for elderly fall detection [12]. Ensemble and IoT-integrated pipelines have also been proposed to reduce false positives by fusing wearable-sensor output with ambient context before an alert is raised [6]. For clinical subpopulations, Nahar et al. specifically evaluated fall-detection performance for elderly users with neurodegenerative disorders, reporting that gait irregularity in this group substantially increases the false-negative rate of models trained on a general elderly population [2]. Okafor and Delgado extended this line of work with a multimodal inertial–acoustic fusion model that reportedly improved pre-impact prediction lead time to over 900 milliseconds across a cohort of ambulatory elderly participants [9], a result that would represent a meaningful improvement over the sub-500-millisecond lead times typically reported elsewhere in this literature [13].

</details>

## 2. Citation health matrix

Checkpoint completion: **0/24** questions answered across 8 claim-citation pairs.

Authenticity: 0/100 `----------`

Relevance: 0/100 `----------`

Depth of reasoning: 0/100 `----------`

**Overall citation quality: 0/100**

**Evidence use.** Strong: 0 · adequate: 0 · weak or unverified: 8 · claims with no citation at all: 0. Revisions recorded after re-reading: 0 of 0 answered checkpoints.

| Band | Count |
| --- | --- |
| High quality | 0 |
| Valid | 0 |
| Weak grounding | 0 |
| Unverified | 8 |

| Marker | Claim | Alignment | Auth | Rel | Depth | Band |
| --- | --- | --- | --- | --- | --- | --- |
| [8] | Threshold-based accelerometer systems worn at the waist can achieve high sensitivity for h… | Not answered | 90 | 0 | 0 | Unverified |
| [1] | Device-free alternatives have also been explored: Tian et al. showed that a convolutional… | Not answered | 90 | 0 | 0 | Unverified |
| [3] | Kwon et al. proposed an energy-efficient classification scheme that distinguishes forward,… | Not answered | 96 | 0 | 0 | Unverified |
| [6] | Ensemble and IoT-integrated pipelines have also been proposed to reduce false positives by… | Not answered | 90 | 0 | 0 | Unverified |
| [9] | Okafor and Delgado extended this line of work with a multimodal inertial–acoustic fusion m… | Not answered | 10 | 0 | 0 | Unverified |
| [4] | Liu et al. examined the impact of accelerometer sampling rate on the accuracy of several m… | Not answered | 78 | 0 | 0 | Unverified |
| [10] | Insole- and footwear-embedded pressure arrays have been proposed as an alternative or comp… | Not answered | 35 | 0 | 0 | Unverified |
| [3] | Taken together, this body of work suggests a shift away from single-sensor, threshold-base… | Not answered | 96 | 0 | 0 | Unverified |

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

> Restraint: Comparison folds diacritics and accepts particle and single-syllable surnames, so "Ondřej", "van Beek" and "He" do not trigger it.

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

## 4. Reasoning trace

### 4.1 Claim (p.1, Sensor modalities)

> Threshold-based accelerometer systems worn at the waist can achieve high sensitivity for high-impact falls, but early implementations suffered elevated false-alarm rates during vigorous non-fall activities such as sitting down quickly [8].

**Cited source** [8] - P. Mostarac, A. Lay-Ekuakille, R. Malaric, M. Jurcevic, and P. Vergallo, “System for monitoring and fall detection of patients using mobile 3-axis accelerometer sensors,” in Proc. IEEE Int. Symp. Med. Meas. Appl. (MeMeA), Bari, Italy, 2011. doi: 10.1109/MeMeA.2011.5966724.

**Source check** verified via crossref, openalex

#### Evidence grounding

**Q.** Which specific sentence or paragraph in [8] explicitly states 'early implementations suffered elevated false-alarm rates during vigorous non-fall activities such as sitting down quickly'?

**A.** _not answered_

#### Source limitations

**Q.** What sample size or population constraints are mentioned in [8] that might have contributed to the 'elevated false-alarm rates' during non-fall activities?

**A.** _not answered_

#### Selection rationale

**Q.** Why was this specific study ([8]) chosen to illustrate the trade-off between sensitivity and false-alarms in threshold-based accelerometer systems, rather than another relevant work from 2011?

**A.** _not answered_

### 4.2 Claim (p.1, Sensor modalities)

> Device-free alternatives have also been explored: Tian et al. showed that a convolutional network applied to RF reflection patterns could detect a fall without requiring the subject to wear any device at all [1], while vision-based systems analysing the motion and shape of the human body over a video stream have reported comparable accuracy in controlled indoor settings, at the cost of requiring fixed camera infrastructure [5].

**Cited source** [1] - Y. Tian, G.-H. Lee, H. He, C.-Y. Hsu, and D. Katabi, “RF-based fall monitoring using convolutional neural networks,” Proc. ACM Interact. Mob. Wearable Ubiquitous Technol., vol. 2, no. 3, pp. 1–24, Sep. 2018. doi: 10.1145/3264947.

**Source check** verified via crossref, openalex

#### Evidence grounding

**Q.** In which specific section or figure of Tian et al.'s paper does it demonstrate a convolutional network detecting falls without requiring devices?

**A.** _not answered_

#### Source limitations

**Q.** What type of environment or scenario is not considered in Tian et al.'s study, according to the authors?

**A.** _not answered_

#### Synthesis across sources

**Q.** How does the vision-based system mentioned alongside Tian et al.'s work differ from their RF-based approach in terms of infrastructure requirements?

**A.** _not answered_

### 4.3 Claim (p.1, Machine learning and deep learning approaches)

> Kwon et al. proposed an energy-efficient classification scheme that distinguishes forward, backward and lateral falls on a resource-constrained wearable platform [3], and the same forward/backward/lateral distinction was later reused as a benchmark task in a broader comparison of ensemble methods for elderly fall detection [12].

**Cited source** [3] - S. B. Kwon, J. H. Park, C. Kwon, H. J. Kong, J. Y. Hwang, and H. C. Kim, “An energy-efficient algorithm for classification of fall types using a wearable sensor,” IEEE Access, vol. 7, pp. 31321–31329, 2019. doi: 10.1109/ACCESS.2019.2902718.

**Source check** verified via crossref, openalex

#### Evidence grounding

**Q.** Which specific section, equation, or table in [3] supports the claim about an energy-efficient classification scheme?

**A.** _not answered_

#### Source limitations

**Q.** What is the primary constraint mentioned by Kwon et al. that affects their proposed algorithm's performance?

**A.** _not answered_

#### Synthesis across sources

**Q.** How does the benchmark task in [12] relate to the original classification scheme proposed in [3], beyond just reusing the forward/backward/lateral distinction?

**A.** _not answered_

### 4.4 Claim (p.1, Machine learning and deep learning approaches)

> Ensemble and IoT-integrated pipelines have also been proposed to reduce false positives by fusing wearable-sensor output with ambient context before an alert is raised [6].

**Cited source** [6] - D. Yacchirema, C. Sarmiento de Puga, C. Palau, and M. Esteve, “Fall detection system for elderly people using IoT and ensemble machine learning algorithm,” Pers. Ubiquitous Comput., 2019. doi: 10.1007/s00779-018-01196-8.

**Source check** verified via crossref, openalex

#### Evidence grounding

**Q.** Which specific section or paragraph in [6] explicitly discusses fusing wearable-sensor output with ambient context to reduce false positives?

**A.** _not answered_

#### Source limitations

**Q.** What are the potential limitations of using IoT-integrated pipelines for fall detection, as discussed in [6], that might affect their performance in real-world scenarios?

**A.** _not answered_

#### Selection rationale

**Q.** Why did you choose to cite [6] specifically to support this claim, rather than another study that also explores IoT-integrated pipelines for fall detection?

**A.** _not answered_

### 4.5 Claim (p.1, Machine learning and deep learning approaches)

> Okafor and Delgado extended this line of work with a multimodal inertial–acoustic fusion model that reportedly improved pre-impact prediction lead time to over 900 milliseconds across a cohort of ambulatory elderly participants [9], a result that would represent a meaningful improvement over the sub-500-millisecond lead times typically reported elsewhere in this literature [13].

**Cited source** [9] - B. Okafor and R. Delgado, “Multimodal inertial–acoustic fusion for pre-impact fall prediction in ambulatory elderly cohorts,” J. Ambient Intell. Ubiquitous Sens., vol. 14, no. 3, pp. 211–229, 2021. doi: 10.9999/jaus.2021.04117.

**Source check** notFound - Neither Crossref nor OpenAlex holds a record matching this reference. Treat as potentially hallucinated or predatory until the student produces the source.

#### Selection rationale

**Q.** Show where you obtained [9]. Can you open the source and point to the passage you used?

**A.** _not answered_

#### Selection rationale

**Q.** What source is [13]? Add the entry, or remove the claim that leans on it.

**A.** _not answered_

#### Evidence grounding

**Q.** What specific sentence or paragraph in [9] supports the claim of improving pre-impact prediction lead time to over 900 milliseconds?

**A.** _not answered_

### 4.6 Claim (p.1, Sensor placement and hardware configuration)

> Liu et al. examined the impact of accelerometer sampling rate on the accuracy of several machine learning models for fall detection, finding that sampling below 20 Hz noticeably degraded recall for lateral falls while offering only a modest reduction in power consumption [4].

**Cited source** [4] - K. Liu, C. Hsieh, S. J. Hsu, and C. Chan, “Impact of sampling rate on wearable-based fall detection systems based on machine learning models,” IEEE Sensors J., vol. 18, no. 23, pp. 9882–9890, 2016. doi: 10.1109/JSEN.2018.2872835.

**Source check** verified via crossref, openalex - Year mismatch: the report cites 2016, the registry records 2018.

#### Selection rationale

**Q.** Which year is right for [4], and did you take the date from the record or from another citation of it?

**A.** _not answered_

#### Evidence grounding

**Q.** Which specific section or figure in Liu et al. (2018) supports the claim about sampling rate and recall for lateral falls?

**A.** _not answered_

#### Source limitations

**Q.** What sample size or participant constraints might have influenced the findings on power consumption reduction?

**A.** _not answered_

### 4.7 Claim (p.1, Sensor placement and hardware configuration)

> Insole- and footwear-embedded pressure arrays have been proposed as an alternative or complementary placement, with piezoresistive insole systems reportedly achieving fall-risk scoring accuracy above 96% in home-based monitoring trials [10], though such placements introduce additional laundering and battery-replacement burdens that waist- or wrist-worn devices do not share.

**Cited source** [10] - B. Osei and R. Whitfield, “Piezoresistive insole arrays for real-time fall-risk scoring in home-based elderly monitoring,” IEEE Trans. Biomed. Eng., vol. 66, no. 11, pp. 3102–3110, 2019. doi: 10.1038/nature14539.

**Source check** suspicious via crossref, openalex - Year mismatch: the report cites 2019, the registry records 2015.; Title differs from the registry record (overlap 0%): "Deep learning".

#### Selection rationale

**Q.** Which work did you actually read for [10] - the one you titled, or the one this DOI returns?

**A.** _not answered_

#### Selection rationale

**Q.** Where did the author names in [10] come from? They are not the authors of the work the identifier returns.

**A.** _not answered_

#### Evidence grounding

**Q.** Which specific section or result in [10] supports the claim of achieving fall-risk scoring accuracy above 96%?

**A.** _not answered_

### 4.8 Claim (p.2, Summary)

> Taken together, this body of work suggests a shift away from single-sensor, threshold-based systems toward multimodal or ensemble pipelines, echoing the fall-type classification approach introduced in [3] and revisited under a resource-constrained deployment setting in [11].

**Cited source** [3] - S. B. Kwon, J. H. Park, C. Kwon, H. J. Kong, J. Y. Hwang, and H. C. Kim, “An energy-efficient algorithm for classification of fall types using a wearable sensor,” IEEE Access, vol. 7, pp. 31321–31329, 2019. doi: 10.1109/ACCESS.2019.2902718.

**Source check** verified via crossref, openalex

#### Evidence grounding

**Q.** Which specific sentence or paragraph in [3] supports the claim of a shift away from single-sensor, threshold-based systems?

**A.** _not answered_

#### Source limitations

**Q.** What is the primary limitation mentioned in [3] that might affect the generalizability of their energy-efficient algorithm?

**A.** _not answered_

#### Synthesis across sources

**Q.** How does the resource-constrained deployment setting in [11] relate to the multimodal or ensemble pipelines discussed in [3], and what implications do these similarities have for system design?

**A.** _not answered_

## 5. Parser notes

- DOCX has no fixed pagination: page numbers are synthetic chunk indices.
- 1 inline marker(s) could not be matched to a reference entry: [13].

---

_Socratic Citation Coach records what the student wrote and how it compared with an independent reading of the same citation. It is evidence for a supervision conversation, not a grade._
