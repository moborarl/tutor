import { useRef, type KeyboardEvent } from 'react';
import { ALL_SUBJECTS, type ChildSubjectSummary } from '../child-learning-state';

export function getSubjectTabId(panelId: string, index: number): string {
  return `${panelId}-tab-${index}`;
}

export function SubjectSwitcher({
  subjects,
  activeSubject,
  onChange,
  panelId,
}: {
  subjects: ChildSubjectSummary[];
  activeSubject: string;
  onChange: (subject: string) => void;
  panelId: string;
}) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const options = [
    {
      subjectName: ALL_SUBJECTS,
      completed: subjects.reduce((sum, subject) => sum + subject.completed, 0),
      total: subjects.reduce((sum, subject) => sum + subject.total, 0),
    },
    ...subjects,
  ];

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number;
    switch (event.key) {
      case 'ArrowLeft':
        nextIndex = (index - 1 + options.length) % options.length;
        break;
      case 'ArrowRight':
        nextIndex = (index + 1) % options.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = options.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    onChange(options[nextIndex].subjectName);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <div
      className="child-subject-switcher"
      role="tablist"
      aria-label="Filter exercises by subject"
      aria-orientation="horizontal"
    >
      {options.map((subject, index) => {
        const selected = subject.subjectName === activeSubject;
        return (
          <button
            ref={(node) => { tabRefs.current[index] = node; }}
            key={subject.subjectName}
            id={getSubjectTabId(panelId, index)}
            className="child-subject-tab"
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(subject.subjectName)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            <span>{subject.subjectName}</span>
            <small>{subject.completed}/{subject.total}</small>
          </button>
        );
      })}
    </div>
  );
}
