import { ALL_SUBJECTS } from '../child-learning-state';

export interface ChildSubjectSummary {
  subjectName: string;
  completed: number;
  total: number;
}

export function SubjectSwitcher({
  subjects,
  activeSubject,
  onChange,
}: {
  subjects: ChildSubjectSummary[];
  activeSubject: string;
  onChange: (subject: string) => void;
}) {
  const options = [
    {
      subjectName: ALL_SUBJECTS,
      completed: subjects.reduce((sum, subject) => sum + subject.completed, 0),
      total: subjects.reduce((sum, subject) => sum + subject.total, 0),
    },
    ...subjects,
  ];

  return (
    <div className="child-subject-switcher" role="tablist" aria-label="Filter exercises by subject">
      {options.map((subject) => {
        const selected = subject.subjectName === activeSubject;
        return (
          <button
            key={subject.subjectName}
            className="child-subject-tab"
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(subject.subjectName)}
          >
            <span>{subject.subjectName}</span>
            <small>{subject.completed}/{subject.total}</small>
          </button>
        );
      })}
    </div>
  );
}
