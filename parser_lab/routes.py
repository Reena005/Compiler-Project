"""
MiniLang-X Parser Lab — Flask API Blueprint Routes (Phase 1 & Phase 2)
"""

from __future__ import annotations

import logging
from flask import Blueprint, request, jsonify

from parser_lab.grammar import parse_grammar_text
from parser_lab.validation import GrammarValidator
from parser_lab.first_follow import FirstFollowCalculator
from parser_lab.tokenizer import tokenize_input_string
from parser_lab.ll1 import LL1TableGenerator, LL1Parser
from parser_lab.recursive_descent import RecursiveDescentParser

logger = logging.getLogger(__name__)

parser_lab_bp = Blueprint("parser_lab", __name__, url_prefix="/api/parser-lab")


def _extract_grammar_request():
    """Helper to parse and validate incoming JSON request with grammar."""
    if not request.is_json:
        return None, (jsonify({
            "success": False,
            "error": "Request body must be valid JSON with 'grammar' string.",
        }), 400)

    data = request.get_json()
    if not isinstance(data, dict):
        return None, (jsonify({
            "success": False,
            "error": "Malformed JSON payload: object expected.",
        }), 400)

    return data, None


@parser_lab_bp.route("/validate", methods=["POST"])
def validate_grammar():
    """
    Validates grammar text and returns structural diagnostics without computing sets.
    """
    data, err_resp = _extract_grammar_request()
    if err_resp:
        return err_resp

    grammar_text = data.get("grammar", "")
    start_symbol = data.get("start_symbol", None)

    try:
        grammar, parse_diagnostics = parse_grammar_text(
            grammar_text, start_symbol=start_symbol
        )
        val_result = GrammarValidator.validate(grammar, parse_diagnostics)

        response_payload = {
            "success": True,
            "valid": val_result.valid,
            "diagnostics": [d.to_dict() for d in val_result.diagnostics],
            "start_symbol": grammar.start_symbol if grammar else None,
            "nonterminals": grammar.nonterminals if grammar else [],
            "terminals": grammar.terminals if grammar else [],
            "productions": [p.to_dict() for p in grammar.productions] if grammar else [],
        }
        return jsonify(response_payload), 200

    except Exception as exc:
        logger.exception("Error during grammar validation: %s", exc)
        return jsonify({
            "success": False,
            "error": "Internal error occurred during grammar validation.",
        }), 500


@parser_lab_bp.route("/first-follow", methods=["POST"])
def compute_first_follow():
    """
    Validates grammar text and computes FIRST and FOLLOW sets.
    """
    data, err_resp = _extract_grammar_request()
    if err_resp:
        return err_resp

    grammar_text = data.get("grammar", "")
    start_symbol = data.get("start_symbol", None)

    try:
        grammar, parse_diagnostics = parse_grammar_text(
            grammar_text, start_symbol=start_symbol
        )
        val_result = GrammarValidator.validate(grammar, parse_diagnostics)

        # If there are fatal grammar errors, do not compute FIRST/FOLLOW
        if not val_result.valid or grammar is None:
            return jsonify({
                "success": True,
                "valid": False,
                "diagnostics": [d.to_dict() for d in val_result.diagnostics],
                "start_symbol": grammar.start_symbol if grammar else None,
                "nonterminals": grammar.nonterminals if grammar else [],
                "terminals": grammar.terminals if grammar else [],
                "productions": [p.to_dict() for p in grammar.productions] if grammar else [],
                "nullable": {},
                "first": {},
                "follow": {},
            }), 200

        calculator = FirstFollowCalculator(grammar)
        result = calculator.compute()

        response_payload = {
            "success": True,
            "valid": True,
            "diagnostics": [d.to_dict() for d in val_result.diagnostics],
            "start_symbol": grammar.start_symbol,
            "nonterminals": grammar.nonterminals,
            "terminals": grammar.terminals,
            "productions": [p.to_dict() for p in grammar.productions],
            "nullable": result.nullable,
            "first": result.first,
            "follow": result.follow,
        }
        return jsonify(response_payload), 200

    except Exception as exc:
        logger.exception("Error during FIRST/FOLLOW computation: %s", exc)
        return jsonify({
            "success": False,
            "error": "Internal error occurred during FIRST/FOLLOW computation.",
        }), 500


@parser_lab_bp.route("/ll1/table", methods=["POST"])
def generate_ll1_table():
    """
    Generates the LL(1) predictive parsing table M[A, a] and conflict diagnostics.
    """
    data, err_resp = _extract_grammar_request()
    if err_resp:
        return err_resp

    grammar_text = data.get("grammar", "")
    start_symbol = data.get("start_symbol", None)

    try:
        grammar, parse_diagnostics = parse_grammar_text(
            grammar_text, start_symbol=start_symbol
        )
        val_result = GrammarValidator.validate(grammar, parse_diagnostics)

        if not val_result.valid or grammar is None:
            return jsonify({
                "success": True,
                "valid": False,
                "is_ll1": False,
                "diagnostics": [d.to_dict() for d in val_result.diagnostics],
                "start_symbol": grammar.start_symbol if grammar else None,
                "nonterminals": grammar.nonterminals if grammar else [],
                "terminals": grammar.terminals if grammar else [],
                "table": {},
                "conflicts": [],
            }), 200

        generator = LL1TableGenerator(grammar)
        table_result = generator.generate()

        response_payload = {
            "success": True,
            "valid": True,
            "is_ll1": table_result.is_ll1,
            "diagnostics": [d.to_dict() for d in val_result.diagnostics],
            "start_symbol": grammar.start_symbol,
            "nonterminals": table_result.nonterminals,
            "terminals": table_result.terminals,
            "table": table_result.to_dict()["table"],
            "conflicts": [c.to_dict() for c in table_result.conflicts],
        }
        return jsonify(response_payload), 200

    except Exception as exc:
        logger.exception("Error during LL(1) table generation: %s", exc)
        return jsonify({
            "success": False,
            "error": "Internal error occurred during LL(1) table generation.",
        }), 500


@parser_lab_bp.route("/ll1/parse", methods=["POST"])
def parse_ll1():
    """
    Parses user-supplied input tokens using the LL(1) table-driven predictive parser.
    """
    data, err_resp = _extract_grammar_request()
    if err_resp:
        return err_resp

    grammar_text = data.get("grammar", "")
    start_symbol = data.get("start_symbol", None)
    input_text = data.get("input", "")

    try:
        grammar, parse_diagnostics = parse_grammar_text(
            grammar_text, start_symbol=start_symbol
        )
        val_result = GrammarValidator.validate(grammar, parse_diagnostics)

        if not val_result.valid or grammar is None:
            return jsonify({
                "success": True,
                "accepted": False,
                "is_ll1": False,
                "tokens": [],
                "trace": [],
                "parse_tree": None,
                "error": "Grammar validation failed. Fix grammar errors before parsing.",
                "diagnostics": [d.to_dict() for d in val_result.diagnostics],
            }), 200

        tokens, tok_errors = tokenize_input_string(input_text, grammar.terminals)
        if tok_errors:
            return jsonify({
                "success": True,
                "accepted": False,
                "is_ll1": False,
                "tokens": tokens,
                "trace": [],
                "parse_tree": None,
                "error": "Tokenization error: " + " ".join(tok_errors),
                "diagnostics": [d.to_dict() for d in val_result.diagnostics],
            }), 200

        parser = LL1Parser(grammar)
        result = parser.parse(tokens)

        response_payload = {
            "success": True,
            "accepted": result.accepted,
            "is_ll1": result.is_ll1,
            "tokens": result.tokens,
            "trace": [s.to_dict() for s in result.trace],
            "parse_tree": result.parse_tree.to_dict() if result.parse_tree else None,
            "error": result.error,
            "diagnostics": [d.to_dict() for d in val_result.diagnostics],
        }
        return jsonify(response_payload), 200

    except Exception as exc:
        logger.exception("Error during LL(1) parse: %s", exc)
        return jsonify({
            "success": False,
            "error": "Internal error occurred during LL(1) parsing.",
        }), 500


@parser_lab_bp.route("/recursive-descent/parse", methods=["POST"])
def parse_recursive_descent():
    """
    Parses user-supplied input tokens using Recursive Descent with left-recursion detection.
    """
    data, err_resp = _extract_grammar_request()
    if err_resp:
        return err_resp

    grammar_text = data.get("grammar", "")
    start_symbol = data.get("start_symbol", None)
    input_text = data.get("input", "")

    try:
        grammar, parse_diagnostics = parse_grammar_text(
            grammar_text, start_symbol=start_symbol
        )
        val_result = GrammarValidator.validate(grammar, parse_diagnostics)

        if not val_result.valid or grammar is None:
            return jsonify({
                "success": True,
                "accepted": False,
                "has_left_recursion": False,
                "tokens": [],
                "trace": [],
                "parse_tree": None,
                "error": "Grammar validation failed. Fix grammar errors before parsing.",
                "diagnostics": [d.to_dict() for d in val_result.diagnostics],
            }), 200

        tokens, tok_errors = tokenize_input_string(input_text, grammar.terminals)
        if tok_errors:
            return jsonify({
                "success": True,
                "accepted": False,
                "has_left_recursion": False,
                "tokens": tokens,
                "trace": [],
                "parse_tree": None,
                "error": "Tokenization error: " + " ".join(tok_errors),
                "diagnostics": [d.to_dict() for d in val_result.diagnostics],
            }), 200

        parser = RecursiveDescentParser(grammar)
        result = parser.parse(tokens)

        response_payload = {
            "success": True,
            "accepted": result.accepted,
            "has_left_recursion": result.has_left_recursion,
            "left_recursion": result.left_recursion.to_dict() if result.left_recursion else None,
            "tokens": result.tokens,
            "trace": [s.to_dict() for s in result.trace],
            "parse_tree": result.parse_tree.to_dict() if result.parse_tree else None,
            "error": result.error,
            "diagnostics": [d.to_dict() for d in val_result.diagnostics],
        }
        return jsonify(response_payload), 200

    except Exception as exc:
        logger.exception("Error during recursive descent parse: %s", exc)
        return jsonify({
            "success": False,
            "error": "Internal error occurred during recursive descent parsing.",
        }), 500
