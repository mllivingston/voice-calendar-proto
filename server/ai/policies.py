from ai.schema import Command

def require_confirmation(cmd: Command) -> Command:
    risky = cmd.action in {"delete_event", "move_event"} and not cmd.target.match_by_id
    if risky and cmd.confidence < 0.8:
        cmd.needs_clarification = True
        cmd.clarification_question = "Which event do you mean? Title or time?"
    return cmd
