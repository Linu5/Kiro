***For hackathon training and assessment. Do not provide this document to the system under test.***

# 1. Test-Case Overview

The student-facing chapter is intentionally polished but evidentially unreliable. It contains positive controls as well as bibliographic, claim-source, synthesis, and document-level failures. The purpose is to test whether a tool asks targeted questions instead of indiscriminately flagging every citation.

The chapter contains exactly 20 bibliography entries. Some are genuine and well matched, some are genuine but misused or corrupted, two are likely fabricated, one is duplicated, one is from a questionable or potentially predatory venue, and one is never cited.

Recommended use: first let participants or the prototype analyse the unannotated chapter. Then compare the output against this key. A strong response should identify uncertainty, request passages or metadata when needed, and distinguish source verification from judgement about how evidence is used.

# 2. Reference-Level Audit

| **Ref.** | **Status** | **Ground-truth note** |
|----|----|----|
| [1] | Valid and substantially complete | Foundational information-retrieval article. |
| [2] | Valid | Static word-embedding preprint; content is overclaimed in the prose. |
| [3] | Valid and appropriately identifies final conference version | Used with an overgeneralised inference. |
| [4] | Valid | Claims and numerical results are misrepresented in the prose. |
| [5] | Valid | Industrial AI lifecycle article; does not establish the claimed 40-60% time reduction. |
| [6] | Valid | Useful review and empirical study; generally well matched in the more critical paragraph. |
| [7] | Genuine but cites preprint instead of final version | Published in NeurIPS 2020, pp. 9459-9474. |
| [8] | Unverifiable / likely fabricated | Plausible corporate title and URL, but no stable source is established. |
| [9] | Valid | Supports calibration discussion. |
| [10] | Valid | Supports abstention/selective-classification discussion. |
| [11] | Valid but cited for opposite conclusion | The paper favours precision-recall over ROC for imbalanced data. |
| [12] | Valid | Supports the general human-in-the-loop definition. |
| [13] | Preprint cited; a published version exists | Appeared in the *Microsoft Journal of Applied Research* 18 (Jan 2023) per the authors' own arXiv note. That venue is unindexed, so "peer reviewed" is unestablished rather than false. |
| [14] | Genuine but author list incomplete | Correct authors: Zicari, Folino, Guarascio, Pontieri. |
| [15] | Genuine, questionable or potentially predatory venue | Should not carry foundational claims without corroboration. |
| [16] | Plausible vendor page; mutable and incomplete as citation | Suitable for features, not independent efficacy. |
| [17] | Fabricated, with a DOI on a borrowed prefix | `10.4187/jaio.2024.120207` returns HTTP 404. The prefix `10.4187` is real — registered to Daedalus Enterprises, publisher of *Respiratory Care* — so the DOI passes format validation and fails only on resolution. *Journal of AI Operations* does not exist. |
| [18] | Duplicate of [13] with altered metadata | Not an independent study. |
| [19] | Valid but poorly matched | Human spaced-repetition research is not evidence for classifier active learning. |
| [20] | Valid but orphaned | Never cited in the chapter. |

# 3. Claim-Level and Synthesis Failures

Each entry gives a location, a diagnosis and the ground truth against which the claim fails.

## 1. Undifferentiated block citation and unsupported scope

| **Location** | Section 2.1, first paragraph: “Many researchers have shown ... [1]-[8].” |
|----|----|
| **Diagnosis** | Eight heterogeneous sources are cited as if all support the complete classification-retrieval-generation workflow. Several cover only one component, and [8] is not verifiable. |
| **Ground truth** | The sources range from term weighting and embeddings to ticket systems and RAG. None establishes that the whole workflow is solved, and [1]-[3] are general NLP foundations rather than service-desk evaluations. |

**Severity: Major**

## 2. Unsupported quantitative benefit

| **Location** | Section 2.1, second paragraph: “reduce resolution time by between 40% and 60% ... [4], [5], [8].” |
|----|----|
| **Diagnosis** | The cited academic studies do not report this shared range, and [8] is fabricated or unverifiable. Classification accuracy is also conflated with resolution-time reduction. |
| **Ground truth** | [4] reports a classification-accuracy improvement up to 81.4% in its study; [5] describes an industrial lifecycle but does not justify the stated 40-60% range. |

**Severity: Major**

## 3. Chronological listing without synthesis

| **Location** | Section 2.2, first paragraph. |
|----|----|
| **Diagnosis** | The paragraph lists TF-IDF, Word2Vec, BERT, and ticket studies by year, then treats chronology as proof that deep learning replaces traditional methods. |
| **Ground truth** | The methods address different representations, datasets, costs, and tasks. Later publication does not establish universal superiority. |

**Severity: Moderate**

## 4. Overstatement of source content

| **Location** | Section 2.2, first paragraph: “Word2Vec ... made every word context-aware.” |
|----|----|
| **Diagnosis** | Word2Vec learns a fixed vector for each vocabulary item; it does not produce context-dependent token representations. |
| **Ground truth** | [2] introduced efficient distributed word representations, whereas contextual representations are characteristic of later models such as BERT. |

**Severity: Major**

## 5. Incorrect statistic and unjustified conclusion

| **Location** | Section 2.2, third paragraph: “reported 95% classification accuracy ... removes the need for manual reassignment [4].” |
|----|----|
| **Diagnosis** | The accuracy is misreported, and the study does not prove that manual reassignment is eliminated. |
| **Ground truth** | [4] reports that including comments and descriptions improved accuracy from 53.8% to 81.4% in its setting. It presents a help-desk system but not zero manual reassignment. |

**Severity: Critical**

## 6. Patchwriting and uncritical adoption

| **Location** | Section 2.2, third paragraph, sentences describing the workflow. |
|----|----|
| **Diagnosis** | The five workflow steps reproduce the source abstract's list in the same order, converting each nominalisation to a verb, with no quotation marks and no citation on the borrowed sentence — the marker sits at the end of the preceding sentence. The paragraph then claims the workflow can be adopted without modification, which the source does not support. |
| **Ground truth** | Abstract of [4], verbatim: "The model is generated according to an empirically developed methodology that is comprised of the following steps: **training tickets generation, ticket data preprocessing, words stemming, feature vectorization, and machine learning algorithm tuning**" and "**associate a help desk ticket with its correct service**". The chapter renders these as "generates training tickets, preprocesses descriptions, performs stemming and vectorisation, tunes the classifier" and "associates each request with the correct service". The source describes one organisation's system and dataset; nothing in it addresses transfer to another. |

**Severity: Major**

## 7. Unqualified superiority claim

| **Location** | Section 2.2, fourth paragraph: “neural models always outperform classical classifiers ... [1]-[8].” |
|----|----|
| **Diagnosis** | The cited works do not support an “always” claim; some are not comparative experiments, and performance depends on data size, labels, computation, and domain shift. |
| **Ground truth** | [6] reports transformer improvements on particular public datasets while also noting dataset and representation dependence. |

**Severity: Major**

## 8. Quote-mining and extrapolation from BERT benchmarks

| **Location** | Section 2.3, first paragraph: short quotation from [3] followed by “proving ... the best general solution for ticket classification.” |
|----|----|
| **Diagnosis** | A benchmark result across eleven NLP tasks is taken as proof for an untested service-desk task. The quotation is not interpreted in its original experimental context. |
| **Ground truth** | [3] establishes strong transfer-learning results but does not study IT tickets or prove universal optimality. |

**Severity: Major**

## 9. Published version not cited; peer review unestablished

| **Location** | Section 2.3, second paragraph: “The peer-reviewed study ... [13].” |
|----|----|
| **Diagnosis** | The entry cites the arXiv preprint, but a published version exists and is not cited. Whether "peer-reviewed" is warranted cannot be established: the venue is a corporate in-house journal with no indexing. |
| **Ground truth** | Z. Liu, C. Benge, and S. Jiang, arXiv:2307.00108 (2023). The authors' arXiv comment records publication in the *Microsoft Journal of Applied Research* (MSJAR), Volume 18, January 2023. MSJAR returns no match in Crossref's journal registry, holds no DOIs, and is not indexed; arXiv's own `journal_ref` and `doi` fields are unset. |

**Severity: Major**

## 10. Duplicate reference treated as independent evidence

| **Location** | Section 2.3, second paragraph; references [13] and [18]. |
|----|----|
| **Diagnosis** | [18] points to the same arXiv record as [13] with a slightly altered title and invented container. The prose calls it a separate experiment. |
| **Ground truth** | Both URLs resolve to arXiv:2307.00108 by Liu, Benge, and Jiang. |

**Severity: Critical**

## 11. RAG claimed to eliminate hallucination

| **Location** | Section 2.4, first and fourth paragraphs. |
|----|----|
| **Diagnosis** | The claim is absolute and not supported by [7]. Retrieval can improve grounding but does not guarantee that generation faithfully uses retrieved evidence. |
| **Ground truth** | [7] evaluates RAG on knowledge-intensive tasks and reports performance improvements; it does not claim complete elimination of hallucinations. |

**Severity: Critical**

## 12. Fabricated or unverifiable vendor research reference

| **Location** | Reference [8] and its use in Sections 2.1 and 2.4. |
|----|----|
| **Diagnosis** | No reliable publication matching the title, URL, and 40% claim is established. The entry resembles a plausible corporate research page. |
| **Ground truth** | The citation lacks named authors, an access date, stable report metadata, and a verifiable landing page. |

**Severity: Critical**

## 13. Questionable venue used for a foundational claim

| **Location** | Section 2.4, second and fourth paragraphs; reference [15]. |
|----|----|
| **Diagnosis** | The paper is treated as authoritative evidence that RAG is mature and low risk without assessing the journal’s credibility or comparing stronger sources. |
| **Ground truth** | The World Journal of Advanced Research and Reviews displays warning signs associated with questionable or potentially predatory publishing. A DOI alone does not establish quality. |

**Severity: Major**

## 14. Composite or hallucinated academic reference

| **Location** | Reference [17] and the claimed 92% reduction in escalations. |
|----|----|
| **Diagnosis** | The journal, DOI, title, and author combination cannot be verified and appears fabricated. |
| **Ground truth** | No stable scholarly record is supplied. The claimed journal and DOI format are plausible-looking but unsupported. |

**Severity: Critical**

## 15. Source cited for the opposite conclusion

| **Location** | Section 2.5, second paragraph: “ROC ... always more informative ... [11].” |
|----|----|
| **Diagnosis** | The cited paper’s title and findings argue that precision-recall plots are more informative than ROC plots for imbalanced binary datasets. |
| **Ground truth** | [11] explicitly supports the opposite position to the sentence. |

**Severity: Critical**

## 16. Irrelevant analogy presented as machine-learning evidence

| **Location** | Section 2.5, third paragraph; reference [19]. |
|----|----|
| **Diagnosis** | A paper on spaced repetition in human learning is used to justify active-learning efficiency for model training without an argued mechanism or empirical bridge. |
| **Ground truth** | [19] concerns human memory and educational practice, not sample selection or model updating. |

**Severity: Moderate**

## 17. Source contradicts removal of human oversight

| **Location** | Section 2.5, fourth paragraph; reference [14]. |
|----|----|
| **Diagnosis** | The student claims the paper makes operator validation unnecessary, but the paper highlights explanations and a human-in-the-loop scheme. |
| **Ground truth** | [14] proposes deep ensembles with explanation mechanisms that help operators identify errors and analysts improve the model. |

**Severity: Critical**

## 18. Incomplete author list in reference [14]

| **Location** | Bibliography entry [14]. |
|----|----|
| **Diagnosis** | Only P. Zicari and L. Pontieri are listed; G. Folino and M. Guarascio are omitted. |
| **Ground truth** | Correct authors: P. Zicari, G. Folino, M. Guarascio, and L. Pontieri. |

**Severity: Major**

## 19. Preprint cited instead of version of record

| **Location** | Bibliography entry [7]. |
|----|----|
| **Diagnosis** | The entry cites only arXiv even though the paper was published in NeurIPS 2020. |
| **Ground truth** | Correct container: Advances in Neural Information Processing Systems 33, pp. 9459-9474 (2020), official NeurIPS proceedings. |

**Severity: Moderate**

## 20. Mutable vendor page used as independent evaluation evidence

| **Location** | Sections 2.4 and 2.6; reference [16]. |
|----|----|
| **Diagnosis** | A product page is used as evidence of effectiveness. It lacks an access date and can change without preserving the version consulted. |
| **Ground truth** | Vendor documentation can establish product features but not independent comparative effectiveness. |

**Severity: Major**

## 21. Overgeneralisation from commercial deployment

| **Location** | Section 2.6, first paragraph: “Vendor systems are more reliable evidence than academic prototypes ...” |
|----|----|
| **Diagnosis** | Payment and deployment scale do not substitute for transparent methods, comparators, or reproducibility. |
| **Ground truth** | Vendor sources and academic studies answer different questions. Product pages can document availability; research can test efficacy under stated conditions. |

**Severity: Moderate**

## 22. Security and privacy deferred without evidence

| **Location** | Section 2.6, second paragraph. |
|----|----|
| **Diagnosis** | The review identifies confidentiality risks but dismisses them as matters for later prompt instructions and role-based access control, without reviewing security or governance literature. |
| **Ground truth** | Tickets may contain personal, operational, and security-sensitive information. Prompt instructions alone are not an access-control mechanism. |

**Severity: Major**

## 23. Internal contradiction and incomplete synthesis

| **Location** | Section 2.6, third paragraph: “No peer-reviewed study describes a complete production workflow ...” |
|----|----|
| **Diagnosis** | Earlier paragraphs presented [4], [5], and [14] as close production evidence. The review does not reconcile what those systems include and what is still missing. |
| **Ground truth** | [4] and [5] describe operational help-desk or assignment systems; [14] integrates classification, explanation, and human involvement. None necessarily combines every proposed component. |

**Severity: Major**

## 24. Orphan bibliography entry

| **Location** | Reference [20]. |
|----|----|
| **Diagnosis** | The source appears in the bibliography but is never cited in the chapter. |
| **Ground truth** | [20] is a genuine early web-based help-desk case study, but it has no in-text citation. |

**Severity: Moderate**

## 25. Unwarranted certainty in final synthesis

| **Location** | Section 2.7, second and third paragraphs. |
|----|----|
| **Diagnosis** | The conclusion converts mixed and partly defective evidence into precise targets and a path to autonomy. It also says assumptions need not be re-evaluated. |
| **Ground truth** | The cited studies use different datasets and outcomes; RAG and confidence thresholds still require local evaluation. Several claimed percentages are unsupported. |

**Severity: Critical**

# 4. Positive Controls

These passages should not be treated as failures merely because the surrounding chapter is defective. They help test precision and restraint.

## 1. Section 2.2, second paragraph

The paragraph treats TF-IDF as a useful local baseline and notes transfer limitations. This is appropriately qualified and supported by [6].

## 2. Section 2.3, third paragraph

The recommendation to compare TF-IDF and BERT on the same split and report macro-F1 is a defensible synthesis rather than a copied conclusion.

## 3. Section 2.4, third paragraph

The sparse-versus-embedding retrieval trade-off is technically plausible and appropriately framed as a design choice, although it would benefit from sources.

## 4. Section 2.5, first paragraph

The distinction between accuracy and calibration, and the use of selective classification for abstention, accurately reflects [9] and [10].

## 5. Section 2.7, first paragraph

The staged architecture is coherent. Its components still require evaluation, but the integration logic is reasonable.

# 5. Verified Core Metadata

- [4] Al-Hawari and Barham: Journal of King Saud University - Computer and Information Sciences, 33(6), 702-718; DOI 10.1016/j.jksuci.2019.04.001. The study reports an improvement from 53.8% to 81.4% when comments and descriptions were included.

- [6] Zangari, Marcuzzo, Schiavinato, Gasparetto, and Albarelli: Expert Systems with Applications 225, article 119984 (2023); DOI 10.1016/j.eswa.2023.119984.

- [7] Lewis et al.: Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks, Advances in Neural Information Processing Systems 33, 9459-9474 (2020); official NeurIPS proceedings.

- [13] Liu, Benge, and Jiang: Ticket-BERT, arXiv:2307.00108 (2023). Published in the *Microsoft Journal of Applied Research* 18 (January 2023) according to the authors' arXiv comment; that venue is unindexed and issues no DOIs.

- [14] Zicari, Folino, Guarascio, and Pontieri: Expert Systems with Applications 206, article 117815 (2022); DOI 10.1016/j.eswa.2022.117815. The paper explicitly includes explanation and human-in-the-loop support.

- [20] Foo, Hui, Leong, and Liu: Computers in Industry 41(2), 129-145 (2000); DOI 10.1016/S0166-3615(99)00037-8.

# 6. Coverage Summary

**Deliberately represented failure modes:** undifferentiated block citation; unsupported quantitative claims; chronological listing without synthesis; static embeddings described as contextual; incorrect statistics; patchwriting; unqualified superiority; quote-mining; preprint misrepresented as peer reviewed; duplicate reference; RAG overclaim; fabricated corporate and academic sources; questionable venue; source cited for the opposite conclusion; irrelevant analogy; source contradicting the claim; incomplete author list; preprint/version-of-record mismatch; mutable vendor evidence; weak source-type discrimination; security literature omitted; internal contradiction; orphan reference; and unwarranted certainty.
