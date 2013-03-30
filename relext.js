/*
 * 4 state machine converting \r || \r\n to \n and splitting a text into
 * paragraphs when there are two or more enters in a row. Also replaces
 * continuous whitespace (possibly interleaved with enters) by a single
 * space. 
 */
var fs = require('fs');

fs.writeFileSync('linebreak.relext',
		'    1:This line started with some spaces and ends with a carriage return\r' + 
		'2:This line ends with spaces before a line feed  \n' +
		'3:This is the third line car+feed\r\n' + 
		'4:The next line will be empty and ill put some spaces around the line \r\n ' + 
		' \r ' +
		'6:That\'s it for today :) oh no wait! unicode! ;D \u20AC YEAH!');


var character = {
	CR: '\r'.charCodeAt(0),
	LF: '\n'.charCodeAt(0),
	TAB: '\t'.charCodeAt(0),
	SPACE: ' '.charCodeAt(0),
	HEADING: '#'.charCodeAt(0),
	carriage: function(c) { return c == this.CR; },
	linefeed: function(c) { return c == this.LF; },
	white: function(c) { return c == this.LF || c == this.TAB || c == this.SPACE; },
	heading: function(c) { return c == this.HEADING; }
};

var filter = {
	// Convert character code to escaped character (string)
	html: function(c) {
		return filter.html.table[c] ? filter.html.table[c] : String.fromCharCode(c);
	}
};

!(function() {
	var t = filter.html.table = {};
	t['<'.charCodeAt(0)] = '&lt;';
	t['>'.charCodeAt(0)] = '&gt;';
	t['&'.charCodeAt(0)] = '&amp;';
	t['"'.charCodeAt(0)] = '&quot;';
	t["'".charCodeAt(0)] = '&#039;';
}());

console.log(filter.html);

var parser = {};

parser.parse = function() {
	var d = this.data;
	var dl = d.length;
	var l = 0; // line
	var c = 0; // column
	var i = 0; // position in buffer
	var t = this.tree = [];
	var state = 'skip';

	var n = undefined;

	while(i < dl) {

		x = d[i];
		c++;

		/* Convert CR and CR+LF to LF */
		if (character.carriage(x)) {
			x = character.LF;
			if (i + 1 < dl && character.linefeed(d[i + 1])) {
				i++;
				// console.log('\n' + l + ':' + c + ' CR + LF');
			} else {
				// console.log('\n' + l + ':' + c + ' CR');
			}
			l++; c = 0;
		} else if (character.linefeed(x)) {
			// console.log('\n' + l + ':' + c + ' LF');
			l++; c = 0;
		}
		
		switch (state) {
		case 'skip':
			if (character.white(x)) {
			} else if (character.heading(x)) {
				state = 'heading1';
			}	else {
				n = {
					type: 'paragraph',
					line: l, column: c,
					contents: filter.html(x)
				};
				state = 'paragraph';
			}
			break;
		case 'paragraph':
			if (character.linefeed(x)) {
				state = 'paragraph-enter';
			} else if (character.white(x)) {
				state = 'paragraph-white';
			} else {
				n.contents += filter.html(x);
			}
			break;
		case 'paragraph-enter':
			if (character.linefeed(x)) {
				t.push(n);
				n = undefined;
				state = 'skip';
			} else if (character.white(x)) {
			} else {
				n.contents += ' ' + filter.html(x);
				state = 'paragraph';
			}
			break;
		case 'paragraph-white':
			if (character.linefeed(x)) {
				state = 'paragraph-enter';
			} else if (character.white(x)) {
			} else {
				n.contents += ' ' + filter.html(x);
				state = 'paragraph';
			}
			break;
		case 'heading1':
			if (character.linefeed(x)) {
				t.push({
					type: 'heading1',
					line: l, column: c,
					contents: ''
				});
				state = 'skip';
			} else if (character.white(x)) {
				n = {
					type: 'heading1',
					line: l, column: c,
					contents: ''
				};
				state = 'heading-skip';
			} else if (character.heading(x)) {
				state = 'heading2';
			} else {
				n = {
					type: 'heading1',
					line: l, column: c,
					contents: filter.html(x)
				};
				state = 'heading';
			}
			break;
		case 'heading2':
			if (character.linefeed(x)) {
				t.push({
					type: 'heading2',
					line: l, column: c,
					contents: ''
				});
				state = 'skip';
			} else if (character.white(x)) {
				n = {
					type: 'heading2',
					line: l, column: c,
					contents: ''
				};
				state = 'heading-skip';
			} else {
				n = {
					type: 'heading2',
					line: l, column: c,
					contents: filter.html(x)
				};
				state = 'heading';
			}
			break;
		case 'heading-skip':
			if (character.linefeed(x)) {
				t.push(n);
				n = undefined;
				state = 'skip';
			} else if (character.white(x)) {
			} else {
				n.contents += filter.html(x);
				state = 'heading';
			}
			break;
		case 'heading-white':
			if (character.linefeed(x)) {
				t.push(n);
				n = undefined;
				state = 'skip';
			} else if (character.white(x)) {
			} else {
				n.contents += ' ' + filter.html(x);
				state = 'heading';
			}
			break;
		case 'heading':
			if (character.linefeed(x)) {
				t.push(n);
				n = undefined;
				state = 'skip';
			} else if (character.white(x)) {
				state = 'heading-white';
			} else {
				n.contents += filter.html(x);
			}
			break;
		}

		i++;

	}

	if (n) {
		t.push(n);
	}

}

var compiler = {};

compiler.compile = function() {
	t = this.tree;

	pre = fs.readFileSync('pre.txt', 'utf8');
	mid = '';
	post = fs.readFileSync('post.txt', 'utf8');

	for (var i = 0, l = t.length; i < l; i++) {
		var n = t[i];
		switch (n.type) {
			case 'paragraph':
				mid += '<p data-line="' + n.line + '" data-column="' + n.column + '">' + n.contents + '</p>\n';
				break;
			case 'heading1':
				mid += '<h1 data-line="' + n.line + '" data-column="' + n.column + '">' + n.contents + '</h1>\n';
				break;
			case 'heading2':
				mid += '<h2 data-line="' + n.line + '" data-column="' + n.column + '">' + n.contents + '</h2>\n';
				break;
		}
	}

	fs.writeFileSync('output.html', pre + mid + post);
};

fs.readFile('input.relext', function (err, data) {
	if (err) { throw err; }

	parser.data = data;
	parser.parse();

	compiler.tree = parser.tree;
	compiler.compile();
});


