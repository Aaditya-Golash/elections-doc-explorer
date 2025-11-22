-- Community edits database schema
-- Separate from main document_analysis.db to keep source data immutable

-- Proposed edits to relationship data
CREATE TABLE edit_proposals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- What triple is being edited
  triple_id INTEGER NOT NULL,  -- References rdf_triples.id in main DB
  doc_id TEXT NOT NULL,        -- Redundant for easier querying

  -- What kind of edit
  edit_type TEXT NOT NULL CHECK(edit_type IN (
    'identify_actor',     -- Identify an unknown actor
    'identify_target',    -- Identify an unknown target
    'correct_actor',      -- Fix misidentified actor
    'correct_target',     -- Fix misidentified target
    'add_context',        -- Add clarifying context
    'dispute'             -- Challenge existing interpretation
  )),

  -- Edit details
  proposed_value TEXT NOT NULL,      -- New actor/target name, or context text
  original_value TEXT NOT NULL,      -- What it currently says

  -- Evidence/reasoning
  evidence_text TEXT NOT NULL,       -- User's explanation
  supporting_doc_ids TEXT,           -- JSON array of related doc IDs

  -- Metadata
  submitter_name TEXT,               -- Optional pseudonym
  submitter_fingerprint TEXT,        -- Browser fingerprint for spam prevention
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN (
    'pending',           -- Awaiting community review
    'accepted',          -- High confidence (net votes > threshold)
    'disputed',          -- Controversial (mixed votes)
    'rejected'           -- Low confidence (negative votes)
  )),

  -- Voting scores
  upvotes INTEGER NOT NULL DEFAULT 0,
  downvotes INTEGER NOT NULL DEFAULT 0,
  net_score INTEGER GENERATED ALWAYS AS (upvotes - downvotes) STORED,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_edit_proposals_triple ON edit_proposals(triple_id);
CREATE INDEX idx_edit_proposals_doc ON edit_proposals(doc_id);
CREATE INDEX idx_edit_proposals_status ON edit_proposals(status);
CREATE INDEX idx_edit_proposals_score ON edit_proposals(net_score DESC);

-- Votes on edit proposals
CREATE TABLE edit_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  edit_proposal_id INTEGER NOT NULL,
  voter_fingerprint TEXT NOT NULL,   -- Browser fingerprint
  vote INTEGER NOT NULL CHECK(vote IN (-1, 1)),  -- -1 = downvote, 1 = upvote
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (edit_proposal_id) REFERENCES edit_proposals(id) ON DELETE CASCADE,
  UNIQUE(edit_proposal_id, voter_fingerprint)  -- One vote per person per edit
);

CREATE INDEX idx_edit_votes_proposal ON edit_votes(edit_proposal_id);

-- Discussion threads on edit proposals
CREATE TABLE edit_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  edit_proposal_id INTEGER NOT NULL,
  parent_comment_id INTEGER,         -- NULL for top-level, or ID of parent comment

  comment_text TEXT NOT NULL,
  commenter_name TEXT,               -- Optional pseudonym
  commenter_fingerprint TEXT,        -- Browser fingerprint

  -- Voting on comments
  upvotes INTEGER NOT NULL DEFAULT 0,
  downvotes INTEGER NOT NULL DEFAULT 0,
  net_score INTEGER GENERATED ALWAYS AS (upvotes - downvotes) STORED,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (edit_proposal_id) REFERENCES edit_proposals(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_comment_id) REFERENCES edit_comments(id) ON DELETE CASCADE
);

CREATE INDEX idx_edit_comments_proposal ON edit_comments(edit_proposal_id);
CREATE INDEX idx_edit_comments_parent ON edit_comments(parent_comment_id);
CREATE INDEX idx_edit_comments_score ON edit_comments(net_score DESC);

-- Votes on comments
CREATE TABLE comment_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comment_id INTEGER NOT NULL,
  voter_fingerprint TEXT NOT NULL,
  vote INTEGER NOT NULL CHECK(vote IN (-1, 1)),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (comment_id) REFERENCES edit_comments(id) ON DELETE CASCADE,
  UNIQUE(comment_id, voter_fingerprint)
);

CREATE INDEX idx_comment_votes_comment ON comment_votes(comment_id);

-- Moderation flags (for spam/abuse reporting)
CREATE TABLE moderation_flags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL CHECK(target_type IN ('edit', 'comment')),
  target_id INTEGER NOT NULL,
  flag_reason TEXT NOT NULL CHECK(flag_reason IN (
    'spam',
    'abuse',
    'misinformation',
    'duplicate'
  )),
  flagger_fingerprint TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(target_type, target_id, flagger_fingerprint)
);

CREATE INDEX idx_moderation_flags_target ON moderation_flags(target_type, target_id);

-- Trigger to update edit_proposals.updated_at
CREATE TRIGGER update_edit_proposal_timestamp
AFTER UPDATE ON edit_proposals
BEGIN
  UPDATE edit_proposals SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger to update upvote/downvote counts on edit_proposals
CREATE TRIGGER update_edit_vote_counts
AFTER INSERT ON edit_votes
BEGIN
  UPDATE edit_proposals
  SET
    upvotes = (SELECT COUNT(*) FROM edit_votes WHERE edit_proposal_id = NEW.edit_proposal_id AND vote = 1),
    downvotes = (SELECT COUNT(*) FROM edit_votes WHERE edit_proposal_id = NEW.edit_proposal_id AND vote = -1)
  WHERE id = NEW.edit_proposal_id;
END;

-- Trigger to update status based on vote threshold
CREATE TRIGGER update_edit_status
AFTER UPDATE OF upvotes, downvotes ON edit_proposals
WHEN NEW.status = 'pending'
BEGIN
  UPDATE edit_proposals
  SET status = CASE
    WHEN NEW.net_score >= 5 THEN 'accepted'
    WHEN NEW.net_score <= -3 THEN 'rejected'
    WHEN (NEW.upvotes + NEW.downvotes) >= 10 AND ABS(NEW.net_score) < 3 THEN 'disputed'
    ELSE 'pending'
  END
  WHERE id = NEW.id;
END;

-- Trigger to update comment vote counts
CREATE TRIGGER update_comment_vote_counts
AFTER INSERT ON comment_votes
BEGIN
  UPDATE edit_comments
  SET
    upvotes = (SELECT COUNT(*) FROM comment_votes WHERE comment_id = NEW.comment_id AND vote = 1),
    downvotes = (SELECT COUNT(*) FROM comment_votes WHERE comment_id = NEW.comment_id AND vote = -1)
  WHERE id = NEW.comment_id;
END;
