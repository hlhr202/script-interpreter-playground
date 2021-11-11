const source = `function test() {
    let a = 1;
    let b = 2;
    return a + b;
}`;

type Token = { token: string; string: string };

const rules: [string, RegExp][] = [
    ["FUNCTION_KEYWORD", /^function/],
    ["RETURN_KEYWORD", /^return/],
    ["LET_KEYWORD", /^let/],

    ["NUMBER", /^\d+(\.\d+)?/],
    ["WORD", /^\w+/],
    ["SPACE", /^\s{1,}/],
    ["SEMI", /^;/],
    ["LINE_BREAK", /^(\r\n|\n|\r)/],
    ["BRACE", /^(\{|\})/],
    ["PAREN", /^(\(|\))/],
    ["PUNCTUATOR", /^(=|\+)/],
];

const tokenize = (source: string) => {
    let tokens: Token[] = [];
    let rest = source;
    while (rest.length) {
        let matchSomeRule = false;
        for (let [name, reg] of rules) {
            const matched = rest.match(reg);
            if (matched) {
                matchSomeRule = true;
                const remainder =
                    rest.substring(0, matched.index) +
                    rest.substring(matched[0].length);
                rest = remainder;
                tokens.push({ token: name, string: matched[0] });
                break;
            }
        }
        if (!matchSomeRule) {
            const str = rest[0];
            rest = rest.substring(0, 1);
            tokens.push({ token: "OTHER", string: str });
            break;
        }
    }
    return tokens;
};

interface INode {
    type: string;
    expression?: string[];
    body?: INode[];
}

class Parser {
    current = 0;

    constructor(public tokens: Token[]) {}

    eat() {
        this.current += 1;
    }
    getToken(x: number = 0): Token | undefined {
        return this.tokens[this.current + x];
    }

    parseFunction() {
        let identifier: string = "";
        while (this.getToken()?.string !== "(") {
            identifier += this.getToken()!.string;
            this.eat();
        }
        identifier = identifier.trim();
        while (this.getToken()?.string !== "{") {
            this.eat();
        }
        this.eat(); // eat {
        const nodes = this.parseNode();
        return { type: "FunctionStatement", identifier, body: nodes };
    }

    parseExpression() {
        const reverseNotation: string[] = [];
        let firstLeft: string | undefined;
        let op: string | undefined;
        while (this.getToken()) {
            switch (this.getToken()?.token) {
                case "PUNCTUATOR": {
                    const t = this.getToken();
                    op = t!.string;
                    this.eat();
                    break;
                }
                case "SEMI":
                case "LINE_BREAK": {
                    this.eat();
                    return reverseNotation;
                }
                case "NUMBER":
                case "WORD": {
                    if (!firstLeft) {
                        firstLeft = this.getToken()!.string;
                        reverseNotation.push(firstLeft);
                    } else {
                        const right = this.getToken()!.string;
                        if (!op) {
                            //error
                        } else {
                            reverseNotation.push(right);
                            reverseNotation.push(op);
                        }
                    }
                    this.eat();
                    break;
                }
                default:
                    this.eat();
                    break;
            }
        }
        return reverseNotation;
    }

    parseAssignStatement() {
        while (this.getToken() && this.getToken()?.token !== "WORD") {
            this.eat();
        }
        const identifier = this.getToken()?.string;
        while (this.getToken() && this.getToken()?.string !== "=") {
            this.eat();
        }
        this.eat();
        const expression = this.parseExpression();
        return { type: "AssignStatement", identifier, expression };
    }

    parseNode() {
        const nodes: INode[] = [];
        while (this.getToken()) {
            switch (this.getToken()?.token) {
                case "SPACE": {
                    this.eat();
                    break;
                }
                case "FUNCTION_KEYWORD": {
                    this.eat();
                    const funcionNode = this.parseFunction();
                    nodes.push(funcionNode);
                    break;
                }
                case "RETURN_KEYWORD": {
                    this.eat();
                    const exp = this.parseExpression();
                    nodes.push({ type: "ReturnExpression", expression: exp });
                    break;
                }
                case "LET_KEYWORD": {
                    this.eat();
                    nodes.push(this.parseAssignStatement());
                    break;
                }
                case "BRACE": {
                    this.eat();
                    if (this.getToken()?.string === "}") {
                        return nodes;
                    }
                }
                default: {
                    this.eat();
                    break;
                }
            }
        }
        return nodes;
    }
}

const parser = new Parser(tokenize(source));
console.log(JSON.stringify(parser.parseNode(), null, 4));
