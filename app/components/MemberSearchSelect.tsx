import { useState, useRef, useEffect } from "react";

type Member = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

interface MemberSearchSelectProps {
  members: Member[];
  value: string;
  onChange: (memberId: string) => void;
  name: string;
  required?: boolean;
  placeholder?: string;
  /** Set of member IDs that should show a warning indicator */
  warningMemberIds?: Set<string>;
  /** Text to show on hover for warning indicator */
  warningTooltip?: string;
}

export function MemberSearchSelect({
  members,
  value,
  onChange,
  name,
  required = false,
  placeholder = "Buscar miembro...",
  warningMemberIds,
  warningTooltip = "Tiene pagos pendientes",
}: MemberSearchSelectProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Find selected member
  const selectedMember = members.find((m) => m.id === value);

  // Filter members based on search
  const filteredMembers = search.trim()
    ? members.filter((member) => {
        const searchLower = search.toLowerCase();
        return (
          member.firstName.toLowerCase().includes(searchLower) ||
          member.lastName.toLowerCase().includes(searchLower) ||
          member.email.toLowerCase().includes(searchLower) ||
          `${member.firstName} ${member.lastName}`.toLowerCase().includes(searchLower)
        );
      })
    : members;

  // Limit results for performance
  const displayMembers = filteredMembers.slice(0, 50);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset highlight when filtered results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [search]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < displayMembers.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case "Enter":
        e.preventDefault();
        if (displayMembers[highlightedIndex]) {
          selectMember(displayMembers[highlightedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        break;
    }
  };

  const selectMember = (member: Member) => {
    onChange(member.id);
    setSearch("");
    setIsOpen(false);
  };

  const clearSelection = () => {
    onChange("");
    setSearch("");
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Hidden input for form submission */}
      <input type="hidden" name={name} value={value} />

      {/* Selected member display or search input */}
      {selectedMember && !isOpen ? (
        <div
          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white flex items-center justify-between cursor-pointer hover:border-gray-500"
          onClick={() => {
            setIsOpen(true);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
        >
          <span>
            {selectedMember.firstName} {selectedMember.lastName}{" "}
            <span className="text-gray-400">({selectedMember.email})</span>
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              clearSelection();
            }}
            className="text-gray-400 hover:text-white ml-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoComplete="off"
        />
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {displayMembers.length === 0 ? (
            <div className="px-4 py-3 text-gray-400 text-sm">
              {search ? "No se encontraron miembros" : "Escribe para buscar..."}
            </div>
          ) : (
            <>
              {filteredMembers.length > 50 && (
                <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-700">
                  Mostrando 50 de {filteredMembers.length} resultados. Escribe para filtrar más.
                </div>
              )}
              {displayMembers.map((member, index) => {
                const hasWarning = warningMemberIds?.has(member.id);
                return (
                  <div
                    key={member.id}
                    onClick={() => selectMember(member)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`px-4 py-3 cursor-pointer ${
                      index === highlightedIndex
                        ? "bg-blue-600 text-white"
                        : "text-gray-200 hover:bg-gray-700"
                    }`}
                  >
                    <div className="font-medium flex items-center gap-2">
                      {member.firstName} {member.lastName}
                      {hasWarning && (
                        <span className="text-yellow-400" title={warningTooltip}>
                          ⚠️
                        </span>
                      )}
                    </div>
                    <div className={`text-sm ${index === highlightedIndex ? "text-blue-200" : "text-gray-400"}`}>
                      {member.email}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* Required validation message */}
      {required && !value && (
        <input
          type="text"
          required
          value=""
          onChange={() => {}}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
