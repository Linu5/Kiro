SINGAPORE TECHNOLOGY SIT]INSTITUTE OFINSTITUTE OF OF 



<!-- Start of picture text -->
SINGAPORE<br>TECHNOLOGY<br>SIT]INSTITUTE OFINSTITUTE OF OF<br><!-- End of picture text -->







(Not more than 800 words) 

- Problem Statement 

_`o` Clearly describe the current issue, gap, or opportunity_ _`o` Explain the context and why it is important to address_ 

- Target Users / Stakeholders 

   - _Who is affected by this problem?_ 

   - _What are their needs or pain points?_ 

- Preliminary AI-Enabled Direction 

   - _Outline an initial idea of how AI could be applied (no need for a fully defined solution)_ 

   - _Indicate possible approaches, tools, or use cases_ 

- Expected Value / Impact 

   - _Describe the potential benefits if the problem is addressed_ 

   - _Consider impact such as scalability, efficiency, or enhancing domain expertise through AI_ 

## **Problem Statement** 

In SIT’s project-based modules (e.g. capstone projects), students are expected to justify design, implementation and evaluation with credible evidence from the literature. However, generative AI tools enable students to produce fluent academic writing without engaging deeply with sources, weakening the visible link between evidence, claims and students’ own understanding. Supervisors usually see a student’s account of their literature review only at a late stage, after reports have been submitted. This situation creates a significant teaching and learning gap. Students receive little early formative feedback on evidence use and may regard AI output as a valid replacement for proper literature review. 

This issue matters because evidence-based reasoning is central to SIT's applied-learning model and to graduates' credibility with industry. Project outputs are visible demonstrations of the model's academic rigour and professional standards. Weak literature-review habits, therefore, risk undermining the standards and reputation on which that model depends. 

The proposal addresses this gap by helping students demonstrate and strengthen the reasoning behind their citations, while keeping the responsibility for reading, evaluating and justifying each source firmly with the student. 

# **Target Users / Stakeholders** 

The solution addresses pain points experienced by students, faculty supervisors and SIT: 

- **Students** in project-based modules are expected to ground their work in a rigorous literature review but receive little timely, specific feedback on their use of sources. They need a structured way to develop evidence-based reasoning habits before final submission, not another tool that writes for them. 

- **Faculty supervisors** need earlier visibility into whether a student has truly engaged with a source or merely inserted a plausible-looking AI-generated citation. They require a scalable way to identify where evidence use is strong, weak or absent so that they can provide effective supervision. 

- **SIT** bears the downstream costs of poor literature-review habits that affect the rigour and reputation of its applied-learning model. Late correction cycles and, in serious cases, academic-misconduct proceedings require substantial staff effort. 

## **Preliminary AI-Enabled Direction** 

The proposed direction is a **formative Socratic citation coach** . At scheduled supervision checkpoints, such as monthly back-to-campus days, students complete a structured evidence-review activity before meeting their supervisors. The system identifies important citations and asks source- <u>specific questions such as: Which passage, result or figure supports your claim? Is the source direct</u> 

2 



evidence, background context or only a related example? What limitation should your reader know? What change did you make after re-reading the source? 

Crucially, the student—not the tool—supplies the supporting passage: the AI prompts, and the student reads, judges and explains. Each exchange produces an auditable reasoning trace consisting of the citation, the question, the student's explanation and any resulting revision. Supervisors can review these traces to guide discussion while retaining academic judgement. 

To **safeguard student data and intellectual property** , in line with SIT's data-protection obligations, the solution uses a privacy-preserving, two-tier architecture: 

- **Tier 1 (Authenticity and Metadata):** To verify source legitimacy, the system queries open scholarly metadata APIs (e.g. Crossref or OpenAlex). Only citation metadata is sent, so no student text leaves SIT. 

- **Tier 2 (Claim Engagement and Questioning):** To map claims to sources and generate questions, the system uses self-hosted parsing (e.g. GROBID) alongside an institutionally controlled large language model—either ClassAId's underlying model or a locally hosted open-weight model (e.g. Llama 3 via Ollama)—so that student drafts remain within SIT's infrastructure and to guarantee long-term maintainability. 

We would pilot the citation coach in an ICT capstone cohort (the SIT-DigiPen Real-Time Interactive Simulation programme, approximately 120 students per year), building the tool either as a standalone web app or a ClassAId extension for long-term maintainability. Integration with the xSITe LMS would be explored with STLA after shortlisting. 

# **Expected Value / Impact** 

Unlike originality or plagiarism tools, the citation coach targets comprehension and justification rather than text matching. It addresses a teaching gap that is not covered by existing tools: formative, source-specific Socratic questioning at the level of a student’s own citations, with a faculty-visible reasoning trace. The impact spans several dimensions: 

- **Students:** 

Literature-review and critical-evaluation skills improve before submission. Students practise using AI responsibly for evidence work, supporting the “AI bilingualism” envisioned by SIT.  **Teaching:** Supervisors spend less time checking whether sources were read and more time on early conversations about evidence, judgement and revision. 

- **University:** SIT strengthens its reputation for rigour in project-based learning and gains a model that can be replicated at other institutions. 

- **Research:** 

With IRB approval, the project can generate novel datasets on how evidence-based reasoning develops in applied learning. 

- **Industry and society:** Graduates are better prepared to defend decisions with credible, well-understood evidence in an AI-augmented workplace. 

Because capstones are a common SIT requirement, a successful ICT pilot offers a clear path to scale across ICT capstones, IWSP reports and, eventually, project-based modules SIT-wide. 

3 

